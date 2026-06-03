import type { certificates, complianceResults, coverages } from "@/db/schema";

export function serializeCertificate(certificate: typeof certificates.$inferSelect) {
  return {
    id: certificate.id,
    account_id: certificate.accountId,
    vendor_id: certificate.vendorId,
    storage_key: certificate.storageKey,
    source: certificate.source,
    status: certificate.status,
    created_at: certificate.createdAt.toISOString(),
    updated_at: certificate.updatedAt.toISOString()
  };
}

export function serializeCoverage(coverage: typeof coverages.$inferSelect) {
  return {
    id: coverage.id,
    account_id: coverage.accountId,
    certificate_id: coverage.certificateId,
    coverage_type: coverage.coverageType,
    insurer: coverage.insurer,
    policy_number: coverage.policyNumber,
    each_occurrence_limit: coverage.eachOccurrenceLimit,
    aggregate_limit: coverage.aggregateLimit,
    effective_date: coverage.effectiveDate,
    expiry_date: coverage.expiryDate,
    additional_insured: coverage.additionalInsured,
    created_at: coverage.createdAt.toISOString()
  };
}

export function serializeComplianceResult(result: typeof complianceResults.$inferSelect) {
  return {
    id: result.id,
    account_id: result.accountId,
    certificate_id: result.certificateId,
    requirement_template_id: result.requirementTemplateId,
    status: result.status,
    reasons: result.reasons,
    evaluated_at: result.evaluatedAt.toISOString()
  };
}
