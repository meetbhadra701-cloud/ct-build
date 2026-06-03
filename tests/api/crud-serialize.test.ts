import assert from "node:assert/strict";
import test from "node:test";

import { serializeRequirementTemplate } from "../../app/api/requirements/_serialize.ts";
import { serializeVendor } from "../../app/api/vendors/_serialize.ts";

test("serializeVendor returns the frozen snake_case API shape", () => {
  const vendor = serializeVendor({
    id: "vendor-1",
    accountId: "account-1",
    name: "Acme Roofing",
    contactEmail: "coi@example.com",
    trade: "roofing",
    status: "active",
    createdAt: new Date("2026-06-03T15:00:00.000Z"),
    updatedAt: new Date("2026-06-03T16:00:00.000Z")
  });

  assert.deepEqual(vendor, {
    id: "vendor-1",
    account_id: "account-1",
    name: "Acme Roofing",
    contact_email: "coi@example.com",
    trade: "roofing",
    status: "active",
    created_at: "2026-06-03T15:00:00.000Z",
    updated_at: "2026-06-03T16:00:00.000Z"
  });
});

test("serializeRequirementTemplate returns the frozen snake_case API shape", () => {
  const requirement = serializeRequirementTemplate({
    id: "requirement-1",
    accountId: "account-1",
    name: "Default vendor requirements",
    rules: {
      general_liability: {
        min_each_occurrence: 1_000_000,
        additional_insured_required: true
      }
    },
    expiringSoonWindowDays: 30,
    createdAt: new Date("2026-06-03T15:00:00.000Z"),
    updatedAt: new Date("2026-06-03T16:00:00.000Z")
  });

  assert.deepEqual(requirement, {
    id: "requirement-1",
    account_id: "account-1",
    name: "Default vendor requirements",
    rules: {
      general_liability: {
        min_each_occurrence: 1_000_000,
        additional_insured_required: true
      }
    },
    expiring_soon_window_days: 30,
    created_at: "2026-06-03T15:00:00.000Z",
    updated_at: "2026-06-03T16:00:00.000Z"
  });
});
