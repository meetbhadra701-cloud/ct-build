import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { complianceResults } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { unauthorized } from "../../_lib/http";

const emptyCounts = {
  compliant: 0,
  "expiring-soon": 0,
  expired: 0,
  "non-compliant": 0
};

export async function GET(_request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const results = await db
    .select({ status: complianceResults.status })
    .from(complianceResults)
    .where(eq(complianceResults.accountId, auth.accountId));

  const counts = { ...emptyCounts };
  for (const result of results) {
    counts[result.status] += 1;
  }

  return NextResponse.json({
    counts,
    generated_at: new Date().toISOString()
  });
}
