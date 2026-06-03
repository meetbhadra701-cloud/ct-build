import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { certificates, complianceResults } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../../_lib/auth";
import { notFound, unauthorized } from "../../../_lib/http";
import { serializeComplianceResult } from "../../../certificates/_serialize";

type RouteContext = {
  params: Promise<{
    certificate_id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const { certificate_id: certificateId } = await context.params;
  const [certificate] = await db
    .select({ id: certificates.id })
    .from(certificates)
    .where(and(eq(certificates.id, certificateId), eq(certificates.accountId, auth.accountId)))
    .limit(1);

  if (!certificate) {
    return notFound("Certificate not found.");
  }

  const [result] = await db
    .select()
    .from(complianceResults)
    .where(
      and(
        eq(complianceResults.certificateId, certificateId),
        eq(complianceResults.accountId, auth.accountId)
      )
    )
    .orderBy(desc(complianceResults.evaluatedAt))
    .limit(1);

  return NextResponse.json({
    result: result ? serializeComplianceResult(result) : null
  });
}
