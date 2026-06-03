export const SYSTEM_PROMPT = `You are a document data extraction specialist for ACORD 25 Certificates of Insurance (COIs).

Extract all insurance coverage information accurately from the provided document.

RULES:
- Extract values exactly as shown; do not infer, estimate, or hallucinate fields.
- For dollar amounts, preserve the full string (e.g. "1,000,000" or "$1,000,000").
- For dates, preserve the format shown (MM/DD/YYYY is most common on ACORD 25).
- If a field is absent or illegible, omit it or return null — do not guess.
- Set additional_insured = true ONLY if the certificate holder is explicitly named as
  additional insured (look for the "Additional Insured" endorsement checkbox or notation).
- Report overall_confidence honestly:
    1.0 = all fields clearly visible, no ambiguity
    0.9 = minor ambiguity, high confidence in core data
    0.8 = some fields unclear or potentially misread
    0.7 = significant difficulty; many fields uncertain
    <0.7 = major extraction problems

This product tracks and organizes compliance data. Do not make judgments about
whether coverage is adequate — extract only what is present in the document.`;

// Tool definition passed to Claude for structured extraction.
// input_schema follows JSON Schema draft-07 as required by the Anthropic tool API.
export const EXTRACTION_TOOL = {
  name: "extract_coi_data",
  description:
    "Extract all structured coverage data from an ACORD 25 Certificate of Insurance.",
  input_schema: {
    type: "object" as const,
    properties: {
      insured_name: {
        type: "string",
        description: "Full legal name of the insured entity.",
      },
      insured_address: {
        type: "string",
        description: "Mailing address of the insured.",
      },
      certificate_holder: {
        type: "string",
        description: "Name and address of the certificate holder.",
      },
      coverages: {
        type: "array",
        description: "All insurance coverage lines found on the certificate.",
        items: {
          type: "object",
          properties: {
            coverage_type: {
              type: "string",
              enum: [
                "general_liability",
                "auto",
                "umbrella",
                "workers_comp",
                "professional",
                "property",
                "other",
              ],
              description: "Normalized coverage type.",
            },
            insurer: {
              type: "string",
              description: "Name of the insurer for this line.",
            },
            policy_number: {
              type: "string",
              description: "Policy number as printed on the document.",
            },
            each_occurrence_limit: {
              type: "string",
              description:
                'Each occurrence limit — raw string from document, e.g. "1,000,000".',
            },
            aggregate_limit: {
              type: "string",
              description: 'General or products aggregate — raw string, e.g. "2,000,000".',
            },
            effective_date: {
              type: "string",
              description: "Policy effective date as printed on the document.",
            },
            expiry_date: {
              type: "string",
              description: "Policy expiration date as printed on the document.",
            },
            additional_insured: {
              type: "boolean",
              description:
                "True only if the certificate holder is explicitly listed as additional insured.",
            },
            confidence: {
              type: "number",
              description: "Your confidence 0–1 for this specific line.",
            },
            notes: {
              type: "string",
              description: "Any ambiguity or difficulty notes for this line.",
            },
          },
          required: ["coverage_type"],
        },
      },
      overall_confidence: {
        type: "number",
        description: "Overall extraction confidence 0.0–1.0.",
      },
      overall_notes: {
        type: "string",
        description: "Notes about the document quality or extraction issues.",
      },
    },
    required: ["coverages", "overall_confidence"],
  },
} as const;
