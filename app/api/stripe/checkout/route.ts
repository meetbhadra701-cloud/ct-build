import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedAccount } from "../../_lib/auth";
import { badRequest, unauthorized } from "../../_lib/http";
import { getRequestOrigin } from "../../_lib/request-url";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "growth"])
});

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAccount();

  if (!auth) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Body must include plan as starter or growth.");
  }

  const origin = getRequestOrigin(request);
  const { createCheckoutSession } = await import("@/lib/payments/checkout");
  const url = await createCheckoutSession({
    accountId: auth.accountId,
    plan: parsed.data.plan,
    customerEmail: auth.email,
    successUrl: `${origin}/billing/success`,
    cancelUrl: `${origin}/billing/cancel`
  });

  return NextResponse.json({ url }, { status: 201 });
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
