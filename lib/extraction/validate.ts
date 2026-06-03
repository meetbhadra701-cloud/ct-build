import type {
  NormalizedCoverage,
  RawCoverage,
  RawExtractionOutput,
  ValidationIssue,
  ValidationResult,
} from "./types";

// Confidence below this triggers HITL review (matches SCHEMA.md).
export const HITL_THRESHOLD = 0.85;

// Maps strings Claude might return to our coverage_type enum.
const COVERAGE_ALIASES: Record<string, NormalizedCoverage["coverage_type"]> = {
  general_liability: "general_liability",
  commercial_general_liability: "general_liability",
  cgl: "general_liability",
  auto: "auto",
  automobile: "auto",
  automobile_liability: "auto",
  commercial_auto: "auto",
  umbrella: "umbrella",
  excess: "umbrella",
  umbrella_excess: "umbrella",
  workers_comp: "workers_comp",
  workers_compensation: "workers_comp",
  workers_comp_employers_liability: "workers_comp",
  employers_liability: "workers_comp",
  professional: "professional",
  professional_liability: "professional",
  errors_omissions: "professional",
  errors_and_omissions: "professional",
  property: "property",
  commercial_property: "property",
  other: "other",
};

// Converts "$1,000,000" or "1000000" → whole dollars as an integer.
// Returns null if the string is absent or unparseable.
export function parseDollarAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  if (!isFinite(num) || num < 0) return null;
  return Math.round(num);
}

// Parses date strings to ISO YYYY-MM-DD.
// Handles: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, and many natural-language forms.
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // MM/DD/YYYY or M/D/YYYY
  const mdySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdySlash) {
    const [, m, d, y] = mdySlash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM-DD-YYYY or M-D-YYYY
  const mdyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDash) {
    const [, m, d, y] = mdyDash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD
  const ymdSlash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (ymdSlash) {
    const [, y, m, d] = ymdSlash;
    return `${y}-${m}-${d}`;
  }

  // Fallback: Date constructor handles many natural-language forms
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return null;
}

function normalizeCoverageType(raw: string): NormalizedCoverage["coverage_type"] {
  const key = raw.toLowerCase().replace(/[\s\-/()]+/g, "_").replace(/_+$/, "");
  return COVERAGE_ALIASES[key] ?? "other";
}

function normalizeCoverage(
  raw: RawCoverage,
  issues: ValidationIssue[]
): NormalizedCoverage {
  const effectiveDate = parseDate(raw.effective_date);
  const expiryDate = parseDate(raw.expiry_date);
  const eachOccurrence = parseDollarAmount(raw.each_occurrence_limit);
  const aggregate = parseDollarAmount(raw.aggregate_limit);
  const label = raw.coverage_type;

  if (raw.effective_date && !effectiveDate) {
    issues.push({
      field: `${label}.effective_date`,
      issue: `Unparseable date: "${raw.effective_date}"`,
      confidence_penalty: 0.10,
    });
  }
  if (raw.expiry_date && !expiryDate) {
    issues.push({
      field: `${label}.expiry_date`,
      issue: `Unparseable date: "${raw.expiry_date}"`,
      confidence_penalty: 0.10,
    });
  }
  if (raw.each_occurrence_limit && eachOccurrence === null) {
    issues.push({
      field: `${label}.each_occurrence_limit`,
      issue: `Unparseable amount: "${raw.each_occurrence_limit}"`,
      confidence_penalty: 0.05,
    });
  }
  if (raw.aggregate_limit && aggregate === null) {
    issues.push({
      field: `${label}.aggregate_limit`,
      issue: `Unparseable amount: "${raw.aggregate_limit}"`,
      confidence_penalty: 0.05,
    });
  }

  // Logical contradiction: effective >= expiry
  if (effectiveDate && expiryDate && effectiveDate >= expiryDate) {
    issues.push({
      field: `${label}.dates`,
      issue: `Effective ${effectiveDate} >= expiry ${expiryDate} — contradictory dates`,
      confidence_penalty: 0.20,
    });
  }

  return {
    coverage_type: normalizeCoverageType(label),
    insurer: raw.insurer?.trim() || null,
    policy_number: raw.policy_number?.trim() || null,
    each_occurrence_limit: eachOccurrence,
    aggregate_limit: aggregate,
    effective_date: effectiveDate,
    expiry_date: expiryDate,
    additional_insured: raw.additional_insured ?? false,
  };
}

// The deterministic validation layer.
// Takes raw model output; returns a normalized result with confidence score and HITL flag.
// This MUST run on every extraction before anything is stored or shown.
export function validateAndNormalize(raw: RawExtractionOutput): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!raw.coverages || raw.coverages.length === 0) {
    issues.push({
      field: "coverages",
      issue: "No coverage lines extracted from document",
      confidence_penalty: 0.30,
    });
  }

  if (!raw.certificate_holder) {
    issues.push({
      field: "certificate_holder",
      issue: "Certificate holder not found",
      confidence_penalty: 0.05,
    });
  }

  const normalizedCoverages = (raw.coverages ?? []).map((c) =>
    normalizeCoverage(c, issues)
  );

  // Cap model's self-reported confidence to 0–1
  const modelConfidence = Math.max(0, Math.min(1, raw.overall_confidence ?? 0.5));
  const totalPenalty = issues.reduce((sum, i) => sum + i.confidence_penalty, 0);
  const finalConfidence = Math.max(0, Math.min(1, modelConfidence - totalPenalty));

  const requiresHitl = finalConfidence < HITL_THRESHOLD;

  // Collect reasons for HITL — surface the highest-penalty issues
  const hitlReasons = issues
    .filter((i) => i.confidence_penalty >= 0.10)
    .map((i) => i.issue);
  if (requiresHitl && hitlReasons.length === 0) {
    hitlReasons.push(
      `Confidence ${finalConfidence.toFixed(2)} below threshold ${HITL_THRESHOLD}`
    );
  }

  return {
    normalized: {
      insured_name: raw.insured_name?.trim() || null,
      certificate_holder: raw.certificate_holder?.trim() || null,
      coverages: normalizedCoverages,
    },
    issues,
    final_confidence: finalConfidence,
    requires_hitl: requiresHitl,
    hitl_reason: requiresHitl ? hitlReasons.join("; ") : undefined,
  };
}
