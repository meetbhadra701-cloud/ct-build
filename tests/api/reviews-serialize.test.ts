import assert from "node:assert/strict";
import test from "node:test";

import { serializeReviewTask } from "../../app/api/reviews/_serialize.ts";

test("serializeReviewTask returns the frozen snake_case API shape", () => {
  const review = serializeReviewTask({
    id: "review-1",
    accountId: "account-1",
    certificateId: "certificate-1",
    reason: "Low confidence",
    status: "resolved",
    resolution: { accepted: true },
    resolvedAt: new Date("2026-06-03T16:30:00.000Z"),
    resolvedBy: "user-1",
    createdAt: new Date("2026-06-03T15:00:00.000Z")
  });

  assert.deepEqual(review, {
    id: "review-1",
    account_id: "account-1",
    certificate_id: "certificate-1",
    reason: "Low confidence",
    status: "resolved",
    resolution: { accepted: true },
    resolved_at: "2026-06-03T16:30:00.000Z",
    resolved_by: "user-1",
    created_at: "2026-06-03T15:00:00.000Z"
  });
});

test("serializeReviewTask preserves unresolved review nulls", () => {
  const review = serializeReviewTask({
    id: "review-2",
    accountId: "account-1",
    certificateId: "certificate-2",
    reason: "Contradictory dates",
    status: "open",
    resolution: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date("2026-06-03T15:00:00.000Z")
  });

  assert.equal(review.resolution, null);
  assert.equal(review.resolved_at, null);
  assert.equal(review.resolved_by, null);
});
