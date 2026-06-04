import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { complianceResults } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { unauthorized } from "../../_lib/http";
import { countLatestComplianceResults, toSnakeCaseRollup } from "./_counts";

export async function GET(_request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const results = await db
    .select({
      certificateId: complianceResults.certificateId,
      status: complianceResults.status,
      evaluatedAt: complianceResults.evaluatedAt
    })
    .from(complianceResults)
    .where(eq(complianceResults.accountId, auth.accountId))
    .orderBy(desc(complianceResults.evaluatedAt));

  const counts = countLatestComplianceResults(results);
  const rollup = toSnakeCaseRollup(counts);

  return NextResponse.json({
    counts,
    ...rollup,
    generated_at: new Date().toISOString()
  });
}
