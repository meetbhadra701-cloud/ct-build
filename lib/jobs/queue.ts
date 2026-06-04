import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, jobs, reminders } from "@/db/schema";
import type { JobPayload, JobType } from "./types";

// Adds a job to the DB-backed queue. Returns the new job's ID.
// runAfter defaults to NOW() using the DB clock to avoid client/server timezone skew.
export async function enqueueJob(params: {
  type: JobType;
  payload: JobPayload;
  runAfter?: Date;
}): Promise<string> {
  const [job] = await db
    .insert(jobs)
    .values({
      type: params.type,
      payload: params.payload as unknown as Record<string, unknown>,
      status: "queued",
      // Use DB's NOW() when no explicit runAfter provided — avoids timezone skew.
      runAfter: params.runAfter ?? sql`NOW()`,
    })
    .returning({ id: jobs.id });

  return job.id;
}

// Default lead-day schedule for expiry reminders (matches lib/dates defaults).
const DEFAULT_LEAD_DAYS = [30, 14, 7, 1];

// Schedules escalating vendor reminder jobs for a certificate that is expiring soon.
// Idempotent — skips escalation levels that already have a reminder record.
// Skips reminders whose scheduled_for date is already in the past.
export async function scheduleRemindersForCertificate(params: {
  certificateId: string;
  accountId: string;
  vendorId: string;
  vendorEmail: string;
  vendorName: string;
  expiryDate: string; // ISO YYYY-MM-DD
  leadDays?: number[];
}): Promise<void> {
  const {
    certificateId,
    accountId,
    vendorId,
    vendorEmail,
    vendorName,
    expiryDate,
  } = params;
  const leadDays = params.leadDays ?? DEFAULT_LEAD_DAYS;

  // Get the account name once for email bodies.
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const accountName = account?.name ?? "Your property manager";

  // Find existing expiry reminders for this certificate (dedup by escalationLevel).
  const existing = await db
    .select({ escalationLevel: reminders.escalationLevel })
    .from(reminders)
    .where(
      and(
        eq(reminders.certificateId, certificateId),
        eq(reminders.accountId, accountId),
        eq(reminders.type, "expiry"),
        isNull(reminders.sentAt) // only unsent ones — don't skip already-sent levels
      )
    );

  const existingLevels = new Set(existing.map((r) => r.escalationLevel));
  const expiryMs = new Date(expiryDate + "T00:00:00Z").getTime();
  const now = Date.now();

  for (let i = 0; i < leadDays.length; i++) {
    const level = i + 1;
    if (existingLevels.has(level)) continue;

    const scheduledFor = new Date(expiryMs - leadDays[i] * 24 * 60 * 60 * 1000);
    if (scheduledFor.getTime() <= now) continue; // past schedule → skip

    const [reminder] = await db
      .insert(reminders)
      .values({
        accountId,
        vendorId,
        certificateId,
        type: "expiry",
        escalationLevel: level,
        scheduledFor,
      })
      .returning({ id: reminders.id });

    await enqueueJob({
      type: "remind",
      payload: {
        reminderId: reminder.id,
        accountId,
        vendorId,
        vendorEmail,
        vendorName,
        accountName,
        certificateId,
        type: "expiry",
        escalationLevel: level,
        expiryDate,
      },
      runAfter: scheduledFor,
    });
  }
}
