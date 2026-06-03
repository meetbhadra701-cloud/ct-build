// Architect-owned. The HITL resolver is the legal shield and accuracy floor.
// Every human decision is recorded and timestamped in the immutable audit_log.
// Codex calls resolveReview() from the POST /api/reviews/:id/resolve handler.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { evaluateCompliance } from "@/lib/compliance/engine";
import {
  auditLog,
  certificates,
  coverages as coveragesTable,
  reviewTasks,
} from "@/db/schema";

// A corrected coverage line provided by the human reviewer.
// Only the fields a reviewer might fix are included — omitted fields are not applied.
export interface CorrectedCoverage {
  coverage_type:
    | "general_liability"
    | "auto"
    | "umbrella"
    | "workers_comp"
    | "professional"
    | "property"
    | "other";
  insurer?: string | null;
  policy_number?: string | null;
  each_occurrence_limit?: number | null; // whole dollars
  aggregate_limit?: number | null;
  effective_date?: string | null; // ISO YYYY-MM-DD
  expiry_date?: string | null;
  additional_insured?: boolean;
}

// The full resolution payload. Codex validates this shape at the API boundary.
export interface ReviewResolution {
  decision: "approve" | "reject";
  // If provided, the reviewer's corrected coverages replace all existing
  // coverage rows for this certificate before compliance is re-evaluated.
  corrected_coverages?: CorrectedCoverage[];
  notes?: string;
}

export interface ResolveResult {
  reviewTaskId: string;
  decision: "approve" | "reject";
  // Populated when decision = 'approve' and a requirement_template_id was supplied.
  complianceStatus?: string;
}

// resolveReview closes a review_task with a human decision.
//
// Parameters:
//   reviewTaskId         — the review_tasks.id being resolved
//   accountId            — tenant scope (never trust from request body)
//   resolvedByUserId     — users.id of the authenticated reviewer
//   resolution           — the decision + optional corrected coverages
//   requirementTemplateId — if provided, compliance is re-evaluated after approval
export async function resolveReview(params: {
  reviewTaskId: string;
  accountId: string;
  resolvedByUserId: string;
  resolution: ReviewResolution;
  requirementTemplateId?: string;
}): Promise<ResolveResult> {
  const {
    reviewTaskId,
    accountId,
    resolvedByUserId,
    resolution,
    requirementTemplateId,
  } = params;

  // Load the review task — scoped by accountId.
  const [task] = await db
    .select()
    .from(reviewTasks)
    .where(
      and(
        eq(reviewTasks.id, reviewTaskId),
        eq(reviewTasks.accountId, accountId)
      )
    )
    .limit(1);

  if (!task) {
    throw new Error(`Review task ${reviewTaskId} not found for account ${accountId}`);
  }
  if (task.status !== "open") {
    throw new Error(`Review task ${reviewTaskId} is already ${task.status}`);
  }

  const { certificateId } = task;
  const now = new Date();

  // --- Decision: REJECT ---
  if (resolution.decision === "reject") {
    await db
      .update(certificates)
      .set({ status: "rejected", updatedAt: now })
      .where(
        and(eq(certificates.id, certificateId), eq(certificates.accountId, accountId))
      );

    await db
      .update(reviewTasks)
      .set({
        status: "resolved",
        resolution: resolution as unknown as Record<string, unknown>,
        resolvedBy: resolvedByUserId,
        resolvedAt: now,
      })
      .where(eq(reviewTasks.id, reviewTaskId));

    // Immutable audit entry — human decision, timestamped. This is the legal record.
    await db.insert(auditLog).values({
      accountId,
      actorType: "user",
      actorId: resolvedByUserId,
      action: "review.rejected",
      entity: `certificate:${certificateId}`,
      after: {
        review_task_id: reviewTaskId,
        decision: "reject",
        notes: resolution.notes ?? null,
      },
    });

    return { reviewTaskId, decision: "reject" };
  }

  // --- Decision: APPROVE ---

  // If the reviewer supplied corrected coverages, replace the existing rows.
  // Delete + insert keeps the history clean — extractions.normalized still holds
  // the original model output; coverages holds the reviewer-accepted data.
  if (resolution.corrected_coverages && resolution.corrected_coverages.length > 0) {
    await db
      .delete(coveragesTable)
      .where(
        and(
          eq(coveragesTable.certificateId, certificateId),
          eq(coveragesTable.accountId, accountId)
        )
      );

    await db.insert(coveragesTable).values(
      resolution.corrected_coverages.map((c) => ({
        accountId,
        certificateId,
        coverageType: c.coverage_type,
        insurer: c.insurer ?? null,
        policyNumber: c.policy_number ?? null,
        eachOccurrenceLimit: c.each_occurrence_limit ?? null,
        aggregateLimit: c.aggregate_limit ?? null,
        effectiveDate: c.effective_date ?? null,
        expiryDate: c.expiry_date ?? null,
        additionalInsured: c.additional_insured ?? false,
      }))
    );
  }

  // Mark the certificate approved.
  await db
    .update(certificates)
    .set({ status: "approved", updatedAt: now })
    .where(
      and(eq(certificates.id, certificateId), eq(certificates.accountId, accountId))
    );

  // Close the review task.
  await db
    .update(reviewTasks)
    .set({
      status: "resolved",
      resolution: resolution as unknown as Record<string, unknown>,
      resolvedBy: resolvedByUserId,
      resolvedAt: now,
    })
    .where(eq(reviewTasks.id, reviewTaskId));

  // Immutable audit entry — the human decision record.
  await db.insert(auditLog).values({
    accountId,
    actorType: "user",
    actorId: resolvedByUserId,
    action: "review.approved",
    entity: `certificate:${certificateId}`,
    after: {
      review_task_id: reviewTaskId,
      decision: "approve",
      corrections_applied: (resolution.corrected_coverages?.length ?? 0) > 0,
      coverage_count: resolution.corrected_coverages?.length ?? null,
      notes: resolution.notes ?? null,
    },
  });

  // Re-evaluate compliance now that the certificate data is human-validated.
  let complianceStatus: string | undefined;
  if (requirementTemplateId) {
    const result = await evaluateCompliance({
      certificateId,
      accountId,
      requirementTemplateId,
    });
    complianceStatus = result.status;
  }

  return { reviewTaskId, decision: "approve", complianceStatus };
}
