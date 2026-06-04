import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { accounts, subscriptions } from "@/db/schema";
import { db } from "@/lib/db/client";
import { getAuthenticatedAccount } from "../../_lib/auth";
import { unauthorized } from "../../_lib/http";

export async function GET(_request: NextRequest) {
  const auth = await getAuthenticatedAccount();
  if (!auth) return unauthorized();

  const [account] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      plan: accounts.plan,
      stripeCustomerId: accounts.stripeCustomerId
    })
    .from(accounts)
    .where(eq(accounts.id, auth.accountId))
    .limit(1);

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.accountId, auth.accountId))
    .limit(1);

  return NextResponse.json({
    account,
    has_stripe_customer: Boolean(account?.stripeCustomerId),
    subscription: subscription
      ? {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          trial_ends_at: subscription.trialEndsAt?.toISOString() ?? null,
          current_period_end: subscription.currentPeriodEnd?.toISOString() ?? null
        }
      : null
  });
}
