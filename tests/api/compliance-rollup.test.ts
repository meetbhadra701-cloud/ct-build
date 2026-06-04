import assert from "node:assert/strict";
import test from "node:test";

import {
  countLatestComplianceResults,
  toSnakeCaseRollup
} from "../../app/api/compliance/rollup/_counts.ts";

test("countLatestComplianceResults counts only the latest result per certificate", () => {
  const counts = countLatestComplianceResults([
    {
      certificateId: "cert-1",
      status: "compliant",
      evaluatedAt: new Date("2026-06-04T01:00:00.000Z")
    },
    {
      certificateId: "cert-1",
      status: "expired",
      evaluatedAt: new Date("2026-06-04T02:00:00.000Z")
    },
    {
      certificateId: "cert-2",
      status: "non-compliant",
      evaluatedAt: new Date("2026-06-04T01:30:00.000Z")
    }
  ]);

  assert.deepEqual(counts, {
    compliant: 0,
    "expiring-soon": 0,
    expired: 1,
    "non-compliant": 1
  });
});

test("toSnakeCaseRollup exposes dashboard totals with API-friendly keys", () => {
  assert.deepEqual(
    toSnakeCaseRollup({
      compliant: 0,
      "expiring-soon": 0,
      expired: 1,
      "non-compliant": 0
    }),
    {
      compliant: 0,
      expiring_soon: 0,
      expired: 1,
      non_compliant: 0,
      total: 1
    }
  );
});
