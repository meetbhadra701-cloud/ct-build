import assert from "node:assert/strict";
import test from "node:test";

import {
  HITL_THRESHOLD,
  parseDate,
  parseDollarAmount,
  validateAndNormalize
} from "../../lib/extraction/validate.ts";
import type { RawExtractionOutput } from "../../lib/extraction/types.ts";

function makeRawExtraction(overrides: Partial<RawExtractionOutput> = {}): RawExtractionOutput {
  return {
    insured_name: "  Acme Roofing LLC  ",
    certificate_holder: "  Northside Property Management  ",
    overall_confidence: 0.96,
    coverages: [
      {
        coverage_type: "Commercial General Liability",
        insurer: "  Example Mutual  ",
        policy_number: " GL-123 ",
        each_occurrence_limit: "$1,000,000",
        aggregate_limit: "2,000,000",
        effective_date: "01/01/2026",
        expiry_date: "01/01/2027",
        additional_insured: true
      }
    ],
    ...overrides
  };
}

test("parseDollarAmount normalizes common COI limit formats", () => {
  assert.equal(parseDollarAmount("$1,000,000"), 1_000_000);
  assert.equal(parseDollarAmount(" 2,500,000 "), 2_500_000);
  assert.equal(parseDollarAmount("1000000.49"), 1_000_000);
  assert.equal(parseDollarAmount("1000000.50"), 1_000_001);
});

test("parseDollarAmount returns null for missing, negative, or unparseable values", () => {
  assert.equal(parseDollarAmount(null), null);
  assert.equal(parseDollarAmount(undefined), null);
  assert.equal(parseDollarAmount(""), null);
  assert.equal(parseDollarAmount("-100"), null);
  assert.equal(parseDollarAmount("not disclosed"), null);
});

test("parseDate normalizes supported date forms to ISO dates", () => {
  assert.equal(parseDate("1/2/2026"), "2026-01-02");
  assert.equal(parseDate("01-02-2026"), "2026-01-02");
  assert.equal(parseDate("2026-01-02"), "2026-01-02");
  assert.equal(parseDate("2026/01/02"), "2026-01-02");
  assert.equal(parseDate("January 2, 2026"), "2026-01-02");
});

test("parseDate returns null for absent or unparseable values", () => {
  assert.equal(parseDate(null), null);
  assert.equal(parseDate(undefined), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate("not a date"), null);
});

test("validateAndNormalize trims names and normalizes coverage fields", () => {
  const result = validateAndNormalize(makeRawExtraction());

  assert.equal(result.final_confidence, 0.96);
  assert.equal(result.requires_hitl, false);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.normalized, {
    insured_name: "Acme Roofing LLC",
    certificate_holder: "Northside Property Management",
    coverages: [
      {
        coverage_type: "general_liability",
        insurer: "Example Mutual",
        policy_number: "GL-123",
        each_occurrence_limit: 1_000_000,
        aggregate_limit: 2_000_000,
        effective_date: "2026-01-01",
        expiry_date: "2027-01-01",
        additional_insured: true
      }
    ]
  });
});

test("validateAndNormalize maps coverage aliases and falls back to other", () => {
  const result = validateAndNormalize(
    makeRawExtraction({
      coverages: [
        { coverage_type: "CGL" },
        { coverage_type: "Workers Comp / Employers Liability" },
        { coverage_type: "Mystery Endorsement" }
      ]
    })
  );

  assert.deepEqual(
    result.normalized.coverages.map((coverage) => coverage.coverage_type),
    ["general_liability", "workers_comp", "other"]
  );
});

test("validateAndNormalize clamps model confidence into the 0 to 1 range", () => {
  assert.equal(validateAndNormalize(makeRawExtraction({ overall_confidence: 2 })).final_confidence, 1);
  assert.equal(validateAndNormalize(makeRawExtraction({ overall_confidence: -1 })).final_confidence, 0);
});

test("validateAndNormalize subtracts deterministic penalties and routes low confidence to HITL", () => {
  const result = validateAndNormalize(
    makeRawExtraction({
      overall_confidence: HITL_THRESHOLD,
      coverages: [
        {
          coverage_type: "Auto",
          each_occurrence_limit: "unknown",
          aggregate_limit: "not listed",
          effective_date: "nonsense",
          expiry_date: "01/01/2027"
        }
      ]
    })
  );

  assert.equal(result.final_confidence.toFixed(2), "0.65");
  assert.equal(result.requires_hitl, true);
  assert.match(result.hitl_reason ?? "", /Unparseable date/);
  assert.equal(result.issues.length, 3);
});

test("validateAndNormalize sends contradictory coverage dates to HITL", () => {
  const result = validateAndNormalize(
    makeRawExtraction({
      coverages: [
        {
          coverage_type: "Umbrella",
          effective_date: "01/01/2027",
          expiry_date: "01/01/2026"
        }
      ]
    })
  );

  assert.equal(result.final_confidence, 0.76);
  assert.equal(result.requires_hitl, true);
  assert.match(result.hitl_reason ?? "", /contradictory dates/);
  assert.deepEqual(result.normalized.coverages[0], {
    coverage_type: "umbrella",
    insurer: null,
    policy_number: null,
    each_occurrence_limit: null,
    aggregate_limit: null,
    effective_date: "2027-01-01",
    expiry_date: "2026-01-01",
    additional_insured: false
  });
});

test("validateAndNormalize penalizes missing certificate holder and missing coverage lines", () => {
  const result = validateAndNormalize(
    makeRawExtraction({
      certificate_holder: null,
      coverages: [],
      overall_confidence: 0.9
    })
  );

  assert.equal(result.final_confidence, 0.55);
  assert.equal(result.requires_hitl, true);
  assert.match(result.hitl_reason ?? "", /No coverage lines extracted/);
});
