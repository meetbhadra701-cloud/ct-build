import { stripe } from "./stripe";

// Creates a Stripe Customer Portal session so the customer can manage their
// subscription, update payment method, or cancel.
export async function createPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });

  return session.url;
}
