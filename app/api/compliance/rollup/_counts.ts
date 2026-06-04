type ComplianceStatus = "compliant" | "expiring-soon" | "expired" | "non-compliant";

export type ComplianceRollupRow = {
  certificateId: string;
  status: ComplianceStatus;
  evaluatedAt: Date;
};

export const emptyCounts: Record<ComplianceStatus, number> = {
  compliant: 0,
  "expiring-soon": 0,
  expired: 0,
  "non-compliant": 0
};

export function countLatestComplianceResults(rows: ComplianceRollupRow[]) {
  const latestByCertificate = new Map<string, ComplianceRollupRow>();

  for (const row of rows) {
    const current = latestByCertificate.get(row.certificateId);
    if (!current || row.evaluatedAt > current.evaluatedAt) {
      latestByCertificate.set(row.certificateId, row);
    }
  }

  const counts = { ...emptyCounts };
  for (const result of latestByCertificate.values()) {
    counts[result.status] += 1;
  }

  return counts;
}

export function toSnakeCaseRollup(counts: Record<ComplianceStatus, number>) {
  const total = counts.compliant + counts["expiring-soon"] + counts.expired + counts["non-compliant"];

  return {
    compliant: counts.compliant,
    expiring_soon: counts["expiring-soon"],
    expired: counts.expired,
    non_compliant: counts["non-compliant"],
    total
  };
}
