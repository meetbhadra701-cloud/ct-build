import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { accounts } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { apiError, unauthorized } from "../../_lib/http";
import { getRequestOrigin } from "../../_lib/request-url";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const [account] = await db
    .select({ stripeCustomerId: accounts.stripeCustomerId })
    .from(accounts)
    .where(eq(accounts.id, auth.accountId))
    .limit(1);

  if (!account?.stripeCustomerId) {
    return apiError(404, "stripe_customer_not_found", "No Stripe customer exists for this account.");
  }

  const { createPortalSession } = await import("@/lib/payments/portal");
  const url = await createPortalSession({
    stripeCustomerId: account.stripeCustomerId,
    returnUrl: `${getRequestOrigin(request)}/billing`
  });

  return NextResponse.json({ url }, { status: 201 });
}
