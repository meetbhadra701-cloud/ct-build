import { NextRequest, NextResponse } from "next/server";

import { apiError } from "../../_lib/http";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return apiError(400, "stripe_webhook_not_configured", "Stripe webhook signature or secret missing.");
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const { processWebhookEvent, verifyAndParseWebhook } = await import("@/lib/payments/webhooks");

  let event;
  try {
    event = verifyAndParseWebhook({
      rawBody,
      signature,
      secret
    });
  } catch {
    return apiError(400, "invalid_stripe_signature", "Invalid Stripe webhook signature.");
  }

  await processWebhookEvent(event);

  return NextResponse.json({ received: true });
}
