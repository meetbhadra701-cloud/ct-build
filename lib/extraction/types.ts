// Raw output from Claude — exactly what the model returns, unvalidated.
export interface RawCoverage {
  coverage_type: string;
  insurer?: string | null;
  policy_number?: string | null;
  each_occurrence_limit?: string | null; // raw string e.g. "$1,000,000"
  aggregate_limit?: string | null;
  effective_date?: string | null; // raw string e.g. "01/01/2025"
  expiry_date?: string | null;
  additional_insured?: boolean | null;
  confidence?: number | null; // model's per-line confidence 0-1
  notes?: string | null;
}

export interface RawExtractionOutput {
  insured_name?: string | null;
  insured_address?: string | null;
  certificate_holder?: string | null;
  coverages: RawCoverage[];
  overall_confidence: number; // model's self-reported confidence 0-1
  overall_notes?: string | null;
}

// After deterministic validation and normalization.
export interface NormalizedCoverage {
  coverage_type:
    | "general_liability"
    | "auto"
    | "umbrella"
    | "workers_comp"
    | "professional"
    | "property"
    | "other";
  insurer: string | null;
  policy_number: string | null;
  each_occurrence_limit: number | null; // whole dollars (integer-safe for PG int4)
  aggregate_limit: number | null;
  effective_date: string | null; // ISO YYYY-MM-DD
  expiry_date: string | null;
  additional_insured: boolean;
}

export interface NormalizedExtractionOutput {
  insured_name: string | null;
  certificate_holder: string | null;
  coverages: NormalizedCoverage[];
}

// A single issue found by the deterministic layer.
export interface ValidationIssue {
  field: string;
  issue: string;
  confidence_penalty: number; // amount subtracted from final confidence
}

// Result of running validateAndNormalize().
export interface ValidationResult {
  normalized: NormalizedExtractionOutput;
  issues: ValidationIssue[];
  final_confidence: number; // clamped 0–1
  requires_hitl: boolean;
  hitl_reason?: string;
}
