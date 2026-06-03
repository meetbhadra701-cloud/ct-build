// Architect-owned: webhook handler is security-critical.
// Stripe signature MUST be verified before any event semantics are read.
// Unverified bodies are rejected with 400 — no exceptions, no fallthrough.
// Codex wires this into app/api/webhooks/stripe/route.ts.

import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { stripe } from "./stripe";
import { db } from "@/lib/db/client";
import { accounts, auditLog, subscriptions } from "@/db/schema";

// Maps Stripe price IDs → our plan names.
function resolvePlan(priceId: string | null | undefined): string {
  if (!priceId) return "unknown";
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return "starter";
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) return "growth";
  return "unknown";
}

// Maps Stripe subscription statuses → our subscription_status enum.
function resolveStatus(
  stripeStatus: Stripe.Subscription.Status
): "trialing" | "active" | "past_due" | "canceled" | "unpaid" {
  const map: Partial<
    Record<
      Stripe.Subscription.Status,
      "trialing" | "active" | "past_due" | "canceled" | "unpaid"
    >
  > = {
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
  };
  return map[stripeStatus] ?? "active";
}

// verifyAndParseWebhook MUST be called before processWebhookEvent.
// Throws if the signature is invalid — callers should return 400.
// The raw body buffer is required; never pass a parsed/re-serialized body.
export function verifyAndParseWebhook(params: {
  rawBody: Buffer | string;
  signature: string;
  secret: string;
}): Stripe.Event {
  return stripe.webhooks.constructEvent(
    params.rawBody,
    params.signature,
    params.secret
  );
}

// Handled events — only these are processed; all others are no-ops (200 OK).
const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  if (!HANDLED_EVENTS.has(event.type)) return; // unknown event → 200 no-op

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session
      );
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }
}

// ── handlers ────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const accountId = session.metadata?.account_id;
  if (!accountId) return; // not our checkout (safety guard)

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!customerId || !subscriptionId) return;

  // Expand the subscription to get full details.
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const priceId = sub.items.data[0]?.price?.id;
  const plan = resolvePlan(priceId);
  const status = resolveStatus(sub.status);

  // Write stripe_customer_id back to the accounts table.
  await db
    .update(accounts)
    .set({ stripeCustomerId: customerId })
    .where(eq(accounts.id, accountId));

  // Create the subscription record.
  await db
    .insert(subscriptions)
    .values({
      accountId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan,
      status,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        status,
        plan,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        updatedAt: new Date(),
      },
    });

  await db.insert(auditLog).values({
    accountId,
    actorType: "system",
    action: "subscription.created",
    entity: `subscription:${subscriptionId}`,
    after: { stripe_customer_id: customerId, plan, status },
  });
}

async function handleSubscriptionUpdated(
  sub: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Resolve our account from the stored customer ID.
  const [existing] = await db
    .select({ accountId: subscriptions.accountId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  if (!existing) return; // subscription not in our system (safe to ignore)

  const { accountId } = existing;
  const priceId = sub.items.data[0]?.price?.id;
  const plan = resolvePlan(priceId);
  const status = resolveStatus(sub.status);

  await db
    .update(subscriptions)
    .set({
      status,
      plan,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));

  await db.insert(auditLog).values({
    accountId,
    actorType: "system",
    action: "subscription.updated",
    entity: `subscription:${sub.id}`,
    after: { stripe_customer_id: customerId, plan, status },
  });
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<void> {
  const [existing] = await db
    .select({ accountId: subscriptions.accountId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  if (!existing) return;

  const { accountId } = existing;

  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));

  await db.insert(auditLog).values({
    accountId,
    actorType: "system",
    action: "subscription.canceled",
    entity: `subscription:${sub.id}`,
    after: { status: "canceled" },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  const [existing] = await db
    .select({ accountId: subscriptions.accountId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!existing) return;

  const { accountId } = existing;

  await db
    .update(subscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

  await db.insert(auditLog).values({
    accountId,
    actorType: "system",
    action: "subscription.payment_failed",
    entity: `subscription:${subscriptionId}`,
    after: { status: "past_due", invoice_id: invoice.id },
  });
}
