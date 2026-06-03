// Architect-owned: job processor is the queue runner.
// Codex wires processNextBatch() into app/api/cron/route.ts (called by cron trigger).

import { and, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { evaluateCompliance } from "@/lib/compliance/engine";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { jobs, reminders } from "@/db/schema";
import { sendVendorReminderEmail } from "./email";
import type { ExtractionJobPayload, ReminderJobPayload } from "./types";

const MAX_ATTEMPTS = 3;

// processNextBatch claims up to batchSize queued jobs, runs them, and returns
// the count of successfully completed jobs.
//
// Claim safety: the transaction SELECT + UPDATE pattern is correct for a
// single-instance cron. For multi-instance deploys, upgrade to:
//   SELECT ... FOR UPDATE SKIP LOCKED
// via db.execute(sql`...`) to prevent double-processing.
export async function processNextBatch(batchSize = 5): Promise<number> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 10 * 60 * 1000); // 10 min stale lock

  // Atomically claim a batch of queued jobs.
  const claimed = await db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          sql`${jobs.status} = 'queued'`,
          lte(jobs.runAfter, now),
          or(isNull(jobs.lockedAt), lt(jobs.lockedAt, staleCutoff))
        )
      )
      .orderBy(jobs.runAfter)
      .limit(batchSize);

    if (candidates.length === 0) return [];

    const ids = candidates.map((j) => j.id);

    return tx
      .update(jobs)
      .set({
        status: "running",
        lockedAt: now,
        attempts: sql`${jobs.attempts} + 1`,
        updatedAt: now,
      })
      .where(inArray(jobs.id, ids))
      .returning({
        id: jobs.id,
        type: jobs.type,
        payload: jobs.payload,
        attempts: jobs.attempts, // post-increment value from RETURNING
      });
  });

  let processed = 0;

  for (const job of claimed) {
    try {
      if (job.type === "extract") {
        await handleExtractJob(job.payload as unknown as ExtractionJobPayload);
      } else if (job.type === "remind") {
        await handleRemindJob(job.payload as unknown as ReminderJobPayload);
      }

      await db
        .update(jobs)
        .set({ status: "succeeded", updatedAt: new Date() })
        .where(sql`${jobs.id} = ${job.id}`);

      processed++;
    } catch (err) {
      const currentAttempts = job.attempts; // post-increment
      const shouldFail = currentAttempts >= MAX_ATTEMPTS;

      // Exponential backoff: 2^(attempt-1) minutes
      const backoffMs = Math.pow(2, currentAttempts - 1) * 60 * 1000;
      const retryAt = new Date(Date.now() + backoffMs);

      await db
        .update(jobs)
        .set({
          status: shouldFail ? "failed" : "queued",
          lockedAt: null,
          runAfter: shouldFail ? jobs.runAfter : retryAt,
          updatedAt: new Date(),
        })
        .where(sql`${jobs.id} = ${job.id}`);

      console.error(
        `[job:${job.type}:${job.id}] attempt ${currentAttempts}/${MAX_ATTEMPTS} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return processed;
}

// ── handlers ────────────────────────────────────────────────────────────────

async function handleExtractJob(payload: ExtractionJobPayload): Promise<void> {
  const result = await runExtractionPipeline({
    certificateId: payload.certificateId,
    accountId: payload.accountId,
    storageKey: payload.storageKey,
    filename: payload.filename,
  });

  // Run compliance immediately if a template is specified and extraction passed.
  if (!result.requiresHitl && payload.requirementTemplateId) {
    await evaluateCompliance({
      certificateId: payload.certificateId,
      accountId: payload.accountId,
      requirementTemplateId: payload.requirementTemplateId,
    });
  }
}

async function handleRemindJob(payload: ReminderJobPayload): Promise<void> {
  await sendVendorReminderEmail({
    to: payload.vendorEmail,
    vendorName: payload.vendorName,
    accountName: payload.accountName,
    type: payload.type,
    escalationLevel: payload.escalationLevel,
    expiryDate: payload.expiryDate,
  });

  // Mark the reminder as sent.
  await db
    .update(reminders)
    .set({ sentAt: new Date() })
    .where(sql`${reminders.id} = ${payload.reminderId} AND ${reminders.accountId} = ${payload.accountId}`);
}
