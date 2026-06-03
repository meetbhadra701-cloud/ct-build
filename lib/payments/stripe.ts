import Stripe from "stripe";

// Singleton Stripe client — import this everywhere instead of calling new Stripe().
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});
