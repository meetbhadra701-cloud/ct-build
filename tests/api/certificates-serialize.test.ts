import assert from "node:assert/strict";
import test from "node:test";

import {
  serializeCertificate,
  serializeComplianceResult,
  serializeCoverage
} from "../../app/api/certificates/_serialize.ts";
import { serializeReminder } from "../../app/api/reminders/_serialize.ts";

test("serializeCertificate returns the frozen snake_case API shape", () => {
  const certificate = serializeCertificate({
    id: "certificate-1",
    accountId: "account-1",
    vendorId: "vendor-1",
    storageKey: "account-1/example.pdf",
    source: "upload",
    status: "processing",
    createdAt: new Date("2026-06-03T15:00:00.000Z"),
    updatedAt: new Date("2026-06-03T16:00:00.000Z")
  });

  assert.deepEqual(certificate, {
    id: "certificate-1",
    account_id: "account-1",
    vendor_id: "vendor-1",
    storage_key: "account-1/example.pdf",
    source: "upload",
    status: "processing",
    created_at: "2026-06-03T15:00:00.000Z",
    updated_at: "2026-06-03T16:00:00.000Z"
  });
});

test("serializeCoverage returns normalized coverage API fields", () => {
  const coverage = serializeCoverage({
    id: "coverage-1",
    accountId: "account-1",
    certificateId: "certificate-1",
    coverageType: "general_liability",
    insurer: "Example Mutual",
    policyNumber: "GL-123",
    eachOccurrenceLimit: 1_000_000,
    aggregateLimit: 2_000_000,
    effectiveDate: "2026-01-01",
    expiryDate: "2027-01-01",
    additionalInsured: true,
    createdAt: new Date("2026-06-03T15:00:00.000Z")
  });

  assert.deepEqual(coverage, {
    id: "coverage-1",
    account_id: "account-1",
    certificate_id: "certificate-1",
    coverage_type: "general_liability",
    insurer: "Example Mutual",
    policy_number: "GL-123",
    each_occurrence_limit: 1_000_000,
    aggregate_limit: 2_000_000,
    effective_date: "2026-01-01",
    expiry_date: "2027-01-01",
    additional_insured: true,
    created_at: "2026-06-03T15:00:00.000Z"
  });
});

test("serializeComplianceResult returns latest result API fields", () => {
  const result = serializeComplianceResult({
    id: "result-1",
    accountId: "account-1",
    certificateId: "certificate-1",
    requirementTemplateId: "template-1",
    status: "compliant",
    reasons: [{ coverage_type: "general_liability", reason: "Meets all requirements" }],
    evaluatedAt: new Date("2026-06-03T15:00:00.000Z")
  });

  assert.deepEqual(result, {
    id: "result-1",
    account_id: "account-1",
    certificate_id: "certificate-1",
    requirement_template_id: "template-1",
    status: "compliant",
    reasons: [{ coverage_type: "general_liability", reason: "Meets all requirements" }],
    evaluated_at: "2026-06-03T15:00:00.000Z"
  });
});

test("serializeReminder returns reminder API fields", () => {
  const reminder = serializeReminder({
    id: "reminder-1",
    accountId: "account-1",
    vendorId: "vendor-1",
    certificateId: "certificate-1",
    type: "expiry",
    scheduledFor: new Date("2026-06-20T15:00:00.000Z"),
    sentAt: null,
    escalationLevel: 2,
    createdAt: new Date("2026-06-03T15:00:00.000Z")
  });

  assert.deepEqual(reminder, {
    id: "reminder-1",
    account_id: "account-1",
    vendor_id: "vendor-1",
    certificate_id: "certificate-1",
    type: "expiry",
    scheduled_for: "2026-06-20T15:00:00.000Z",
    sent_at: null,
    escalation_level: 2,
    created_at: "2026-06-03T15:00:00.000Z"
  });
});
