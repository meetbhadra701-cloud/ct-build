import type { reviewTasks } from "@/db/schema";

export function serializeReviewTask(review: typeof reviewTasks.$inferSelect) {
  return {
    id: review.id,
    account_id: review.accountId,
    certificate_id: review.certificateId,
    reason: review.reason,
    status: review.status,
    resolution: review.resolution,
    resolved_at: review.resolvedAt?.toISOString() ?? null,
    resolved_by: review.resolvedBy,
    created_at: review.createdAt.toISOString()
  };
}
