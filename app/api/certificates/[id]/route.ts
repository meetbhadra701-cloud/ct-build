import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { certificates, complianceResults, coverages } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { notFound, unauthorized } from "../../_lib/http";
import {
  serializeCertificate,
  serializeComplianceResult,
  serializeCoverage
} from "../_serialize";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const { id } = await context.params;
  const [certificate] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.id, id), eq(certificates.accountId, auth.accountId)))
    .limit(1);

  if (!certificate) {
    return notFound("Certificate not found.");
  }

  const coverageRows = await db
    .select()
    .from(coverages)
    .where(and(eq(coverages.certificateId, id), eq(coverages.accountId, auth.accountId)))
    .orderBy(coverages.createdAt);

  const [latestComplianceResult] = await db
    .select()
    .from(complianceResults)
    .where(
      and(eq(complianceResults.certificateId, id), eq(complianceResults.accountId, auth.accountId))
    )
    .orderBy(desc(complianceResults.evaluatedAt))
    .limit(1);

  return NextResponse.json({
    certificate: serializeCertificate(certificate),
    coverages: coverageRows.map(serializeCoverage),
    latest_compliance_result: latestComplianceResult
      ? serializeComplianceResult(latestComplianceResult)
      : null
  });
}
