import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-client";
import { createServiceClient } from "@/lib/supabase";
import { planFromPriceId } from "@/lib/stripe-config";
import { SUBSCRIPTION_PLANS, type SubscriptionStatus } from "@/lib/subscription-plans";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function customerIdOf(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function tsToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
      return status;
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return "past_due";
    case "paused":
      return "canceled";
    default:
      return "past_due";
  }
}

async function syncSubscriptionToAgent(subscription: Stripe.Subscription) {
  const db = createServiceClient();
  const customerId = customerIdOf(subscription.customer);
  if (!customerId) {
    console.warn(`Subscription ${subscription.id} has no customer; skipping sync.`);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const plan = planFromPriceId(priceId);

  const update: Record<string, unknown> = {
    subscription_status: mapStripeStatus(subscription.status),
    subscription_start: tsToIso(item?.current_period_start),
    subscription_end: tsToIso(item?.current_period_end),
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
  };

  if (plan) {
    update.subscription_plan = plan;
    update.leads_limit_monthly = SUBSCRIPTION_PLANS[plan].leads_limit;
  }

  const { error } = await db.from("agents").update(update).eq("stripe_customer_id", customerId);
  if (error) {
    console.error(`Failed to sync subscription ${subscription.id} to agent (customer ${customerId}):`, error);
  }
}

async function markSubscriptionCancelled(subscription: Stripe.Subscription) {
  const db = createServiceClient();
  const customerId = customerIdOf(subscription.customer);
  if (!customerId) return;

  const item = subscription.items.data[0];

  const { error } = await db
    .from("agents")
    .update({
      subscription_status: "canceled" as SubscriptionStatus,
      subscription_end: tsToIso(item?.current_period_end),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error(`Failed to mark subscription ${subscription.id} canceled:`, error);
  }
}

async function markPaymentFailed(invoice: Stripe.Invoice) {
  const db = createServiceClient();
  const customerId = customerIdOf(invoice.customer ?? null);
  if (!customerId) return;

  const { error } = await db
    .from("agents")
    .update({ subscription_status: "past_due" as SubscriptionStatus })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error(`Failed to mark payment_failed on customer ${customerId}:`, error);
  }
  // TODO: notify the agent by email that their payment failed.
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret.startsWith("whsec_placeholder")) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const headersList = await headers();
  const signature = headersList.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(`Stripe webhook signature verification failed: ${msg}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscriptionToAgent(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await markSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        // No-op; subscription.created/updated already syncs the plan.
        break;
      case "invoice.payment_failed":
        await markPaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler error for ${event.type}:`, err);
    // Return 200 so Stripe doesn't retry endlessly on logic bugs — investigate via logs.
    return NextResponse.json({ received: true, error: "handler_error" });
  }

  return NextResponse.json({ received: true });
}
