import { z } from "zod";

const coverageTypes = ["general_liability", "auto", "umbrella", "workers_comp"] as const;

const ruleValueSchema = z.object({
  coverage_type: z.enum(coverageTypes).optional(),
  min_each_occurrence: z.number().int().nonnegative().nullable().optional(),
  min_aggregate: z.number().int().nonnegative().nullable().optional(),
  additional_insured_required: z.boolean().optional()
});

const rulesRecordSchema = z
  .object({
    general_liability: ruleValueSchema.optional(),
    auto: ruleValueSchema.optional(),
    umbrella: ruleValueSchema.optional(),
    workers_comp: ruleValueSchema.optional()
  })
  .refine((rules) => Object.values(rules).some(Boolean), {
    message: "At least one coverage rule is required."
  });

export type RequirementRule = {
  coverage_type: (typeof coverageTypes)[number];
  min_each_occurrence?: number | null;
  min_aggregate?: number | null;
  additional_insured_required?: boolean;
};

export const rulesInputSchema = z
  .union([
    z.array(ruleValueSchema.extend({ coverage_type: z.enum(coverageTypes) })).min(1),
    rulesRecordSchema
  ])
  .transform((rules): RequirementRule[] => {
    if (Array.isArray(rules)) {
      return rules.map(normalizeRule);
    }

    return Object.entries(rules)
      .filter((entry): entry is [RequirementRule["coverage_type"], NonNullable<typeof entry[1]>] =>
        Boolean(entry[1])
      )
      .map(([coverageType, rule]) =>
        normalizeRule({
          ...rule,
          coverage_type: rule.coverage_type ?? coverageType
        })
      );
  })
  .refine((rules) => new Set(rules.map((rule) => rule.coverage_type)).size === rules.length, {
    message: "Each coverage type can appear only once."
  });

export function serializeRulesForContract(input: unknown): Record<string, unknown> {
  if (!Array.isArray(input)) {
    return isRecord(input) ? input : {};
  }

  return input.reduce<Record<string, unknown>>((acc, rawRule) => {
    if (!isRecord(rawRule) || typeof rawRule.coverage_type !== "string") return acc;
    const { coverage_type: coverageType, ...rule } = rawRule;
    acc[coverageType] = rule;
    return acc;
  }, {});
}

function normalizeRule(rule: z.infer<typeof ruleValueSchema> & { coverage_type: RequirementRule["coverage_type"] }) {
  return {
    coverage_type: rule.coverage_type,
    ...(rule.min_each_occurrence !== undefined ? { min_each_occurrence: rule.min_each_occurrence } : {}),
    ...(rule.min_aggregate !== undefined ? { min_aggregate: rule.min_aggregate } : {}),
    ...(rule.additional_insured_required !== undefined
      ? { additional_insured_required: rule.additional_insured_required }
      : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
