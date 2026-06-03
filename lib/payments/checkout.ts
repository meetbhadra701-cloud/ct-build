import { stripe } from "./stripe";

const PRICE_IDS: Record<"starter" | "growth", string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  growth: process.env.STRIPE_GROWTH_PRICE_ID!,
};

// Creates a Stripe Checkout session for a new subscription.
// - 14-day free trial; card is required upfront (no free rides).
// - Cancel any time; access lasts through the current period.
// - metadata.account_id lets the webhook handler resolve back to our tenant.
export async function createCheckoutSession(params: {
  accountId: string;
  plan: "starter" | "growth";
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const { accountId, plan, customerEmail, successUrl, cancelUrl } = params;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: customerEmail,
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { account_id: accountId },
    },
    // Card is required upfront even during trial.
    payment_method_collection: "always",
    metadata: { account_id: accountId },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: false,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}
