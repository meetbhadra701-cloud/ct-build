// Architect-owned: the compliance engine is the product moat.
// It tracks and matches requirements. It does NOT advise on coverage adequacy.
// Codex never edits this file.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  auditLog,
  certificates,
  complianceResults,
  coverages as coveragesTable,
  requirementTemplates,
} from "@/db/schema";

// Shape of a single rule in requirement_templates.rules JSONB.
// All amounts in whole dollars (matches the integer column in coverages).
export interface RequirementRule {
  coverage_type: string;
  min_each_occurrence?: number | null;
  min_aggregate?: number | null;
  additional_insured_required?: boolean;
}

export type ComplianceStatus =
  | "compliant"
  | "expiring-soon"
  | "expired"
  | "non-compliant";

interface RuleResult {
  coverage_type: string;
  status: ComplianceStatus;
  reason: string;
}

export interface ComplianceEvaluation {
  complianceResultId: string;
  status: ComplianceStatus;
  ruleResults: RuleResult[];
}

// Determine the expiry status of a single coverage line.
// Policy: a coverage IS expired on the expiry date itself (matches Codex's lib/dates).
function expiryStatus(
  expiryDate: string | null,
  windowDays: number
): "expired" | "expiring-soon" | "active" {
  if (!expiryDate) return "active"; // missing date is flagged by extraction HITL, not compliance

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + "T00:00:00Z");

  if (expiry <= today) return "expired";

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  if (expiry.getTime() - today.getTime() <= windowMs) return "expiring-soon";

  return "active";
}

type CoverageRow = {
  coverageType: string;
  eachOccurrenceLimit: number | null;
  aggregateLimit: number | null;
  additionalInsured: boolean;
  expiryDate: string | null;
  effectiveDate: string | null;
};

// Evaluate a single requirement rule against the available coverage lines.
function evaluateRule(
  rule: RequirementRule,
  coverages: CoverageRow[],
  windowDays: number
): RuleResult {
  const matching = coverages.filter((c) => c.coverageType === rule.coverage_type);

  if (matching.length === 0) {
    return {
      coverage_type: rule.coverage_type,
      status: "non-compliant",
      reason: `No ${rule.coverage_type} coverage found on certificate`,
    };
  }

  // A coverage line "passes" limits if it meets all minimum thresholds.
  // We pick the best available line (the one that passes all checks if any does).
  const passing = matching.filter((c) => {
    if (
      rule.min_each_occurrence != null &&
      (c.eachOccurrenceLimit ?? 0) < rule.min_each_occurrence
    )
      return false;
    if (
      rule.min_aggregate != null &&
      (c.aggregateLimit ?? 0) < rule.min_aggregate
    )
      return false;
    if (rule.additional_insured_required && !c.additionalInsured) return false;
    return true;
  });

  if (passing.length === 0) {
    // Build a clear reason from the first coverage found.
    const sample = matching[0];
    const reasons: string[] = [];

    if (
      rule.min_each_occurrence != null &&
      (sample.eachOccurrenceLimit ?? 0) < rule.min_each_occurrence
    ) {
      reasons.push(
        `Each occurrence $${(sample.eachOccurrenceLimit ?? 0).toLocaleString()} < required $${rule.min_each_occurrence.toLocaleString()}`
      );
    }
    if (
      rule.min_aggregate != null &&
      (sample.aggregateLimit ?? 0) < rule.min_aggregate
    ) {
      reasons.push(
        `Aggregate $${(sample.aggregateLimit ?? 0).toLocaleString()} < required $${rule.min_aggregate.toLocaleString()}`
      );
    }
    if (rule.additional_insured_required && !sample.additionalInsured) {
      reasons.push("Additional insured endorsement not found");
    }

    return {
      coverage_type: rule.coverage_type,
      status: "non-compliant",
      reason: reasons.join("; ") || "Coverage does not meet requirements",
    };
  }

  // Limits pass — determine expiry status.
  // If ANY passing line is active (not expiring), the rule is satisfied.
  // If all passing lines are expired, rule is expired.
  // If all passing lines are expiring-soon (none active), rule is expiring-soon.
  const statuses = passing.map((c) => expiryStatus(c.expiryDate, windowDays));

  if (statuses.every((s) => s === "expired")) {
    return {
      coverage_type: rule.coverage_type,
      status: "expired",
      reason: `${rule.coverage_type} coverage is expired`,
    };
  }

  if (statuses.every((s) => s !== "active")) {
    // All passing lines are expiring-soon (none expired, none active)
    const earliest = passing
      .filter((c) => expiryStatus(c.expiryDate, windowDays) === "expiring-soon")
      .sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""))[0];
    return {
      coverage_type: rule.coverage_type,
      status: "expiring-soon",
      reason: `${rule.coverage_type} coverage expires ${earliest?.expiryDate ?? "soon"}`,
    };
  }

  return {
    coverage_type: rule.coverage_type,
    status: "compliant",
    reason: "Meets all requirements",
  };
}

// Aggregate per-rule results into a single status.
// Priority: non-compliant > expired > expiring-soon > compliant.
// An empty rule set (no requirements) is trivially compliant.
function aggregateStatus(results: RuleResult[]): ComplianceStatus {
  if (results.length === 0) return "compliant";
  if (results.some((r) => r.status === "non-compliant")) return "non-compliant";
  if (results.some((r) => r.status === "expired")) return "expired";
  if (results.some((r) => r.status === "expiring-soon")) return "expiring-soon";
  return "compliant";
}

// evaluateCompliance is the core compliance evaluation.
// Call it after a certificate's extraction has been validated and approved.
// Returns the result and persists a compliance_result row + audit_log entry.
export async function evaluateCompliance(params: {
  certificateId: string;
  accountId: string;
  requirementTemplateId: string;
}): Promise<ComplianceEvaluation> {
  const { certificateId, accountId, requirementTemplateId } = params;

  // Every query is scoped by accountId — the #1 correctness property.
  const [template] = await db
    .select()
    .from(requirementTemplates)
    .where(
      and(
        eq(requirementTemplates.id, requirementTemplateId),
        eq(requirementTemplates.accountId, accountId)
      )
    )
    .limit(1);

  if (!template) {
    throw new Error(
      `Requirement template ${requirementTemplateId} not found for account ${accountId}`
    );
  }

  const coverageRows = await db
    .select()
    .from(coveragesTable)
    .where(
      and(
        eq(coveragesTable.certificateId, certificateId),
        eq(coveragesTable.accountId, accountId)
      )
    );

  const rules = (template.rules as RequirementRule[]) ?? [];
  const windowDays = template.expiringSoonWindowDays ?? 30;

  const ruleResults = rules.map((rule) =>
    evaluateRule(rule, coverageRows, windowDays)
  );

  const overallStatus = aggregateStatus(ruleResults);

  // Persist: insert a new compliance_result (history is preserved; we never overwrite).
  const [saved] = await db
    .insert(complianceResults)
    .values({
      accountId,
      certificateId,
      requirementTemplateId,
      status: overallStatus,
      reasons: ruleResults as unknown as Record<string, unknown>[],
    })
    .returning({ id: complianceResults.id });

  // Immutable audit entry.
  await db.insert(auditLog).values({
    accountId,
    actorType: "system",
    action: "compliance.evaluated",
    entity: `certificate:${certificateId}`,
    after: {
      compliance_result_id: saved.id,
      status: overallStatus,
      requirement_template_id: requirementTemplateId,
      rule_results: ruleResults,
    },
  });

  return {
    complianceResultId: saved.id,
    status: overallStatus,
    ruleResults,
  };
}

// evaluateAllTemplatesForCert is called after extraction completes.
// Finds every requirement template for the account and evaluates the cert against each.
// A new account with no templates gets 0 compliance results — that is correct.
export async function evaluateAllTemplatesForCert(params: {
  certificateId: string;
  accountId: string;
}): Promise<ComplianceEvaluation[]> {
  const { certificateId, accountId } = params;

  const templates = await db
    .select({ id: requirementTemplates.id })
    .from(requirementTemplates)
    .where(eq(requirementTemplates.accountId, accountId));

  if (templates.length === 0) return [];

  return Promise.all(
    templates.map((t) =>
      evaluateCompliance({
        certificateId,
        accountId,
        requirementTemplateId: t.id,
      })
    )
  );
}

// reevaluateAllCertsForTemplate is called after a requirement template is created or
// updated. It re-evaluates every approved certificate for the account so the dashboard
// reflects the new rules without waiting for the next upload.
export async function reevaluateAllCertsForTemplate(params: {
  requirementTemplateId: string;
  accountId: string;
}): Promise<number> {
  const { requirementTemplateId, accountId } = params;

  // Only re-evaluate approved certs (extraction passed, not stuck in review).
  // Certs still processing or in review will be evaluated when they exit that state.
  const approvedCerts = await db
    .select({ id: certificates.id })
    .from(certificates)
    .where(
      and(
        eq(certificates.accountId, accountId),
        eq(certificates.status, "approved")
      )
    );

  if (approvedCerts.length === 0) return 0;

  // Only re-evaluate certs that actually have extracted coverage lines.
  const certIds = approvedCerts.map((c) => c.id);
  const certsWithCoverages = await db
    .selectDistinct({ certId: coveragesTable.certificateId })
    .from(coveragesTable)
    .where(
      and(
        eq(coveragesTable.accountId, accountId),
        inArray(coveragesTable.certificateId, certIds)
      )
    );

  const evaluableCertIds = certsWithCoverages.map((r) => r.certId);
  if (evaluableCertIds.length === 0) return 0;

  await Promise.all(
    evaluableCertIds.map((certId) =>
      evaluateCompliance({
        certificateId: certId,
        accountId,
        requirementTemplateId,
      })
    )
  );

  return evaluableCertIds.length;
}
