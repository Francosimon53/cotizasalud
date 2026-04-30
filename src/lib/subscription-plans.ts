// Single source of truth for the SaaS plan catalog.
//
// `PLAN_CATALOG` lists every value of `agents.subscription_plan`. The 3 paid
// tiers (basic/pro/advanced) each carry a `prices` map with monthly and
// yearly Stripe price IDs (resolved lazily from env vars so the same module
// works in build, runtime, and test). Trial and legacy_early_adopter have no
// `prices` map — they're $0 and don't go through Stripe checkout.
//
// All identifiers stay in English to match the DB CHECK constraint
// `agents_subscription_plan_check`. UI labels live in the `name` field.

export type PlanTier = "basic" | "pro" | "advanced";
export type BillingInterval = "month" | "year";
export type SubscriptionPlan = "trial" | PlanTier | "legacy_early_adopter";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing";

export const TRIAL_DAYS = 14;

export const PAID_PLANS: readonly PlanTier[] = ["basic", "pro", "advanced"];
export const BILLING_INTERVALS: readonly BillingInterval[] = ["month", "year"];

export const PLAN_CATALOG = {
  trial: { name: "Trial", leads_limit: 200, price_usd: 0 },
  basic: {
    name: "Básico",
    leads_limit: 50,
    price_usd: 29,
    prices: {
      month: { amount_usd: 29, price_id_env: "STRIPE_PRICE_BASIC" },
      year: { amount_usd: 290, price_id_env: "STRIPE_PRICE_BASIC_YEARLY" },
    },
  },
  pro: {
    name: "Pro",
    leads_limit: 200,
    price_usd: 79,
    prices: {
      month: { amount_usd: 79, price_id_env: "STRIPE_PRICE_PRO" },
      year: { amount_usd: 790, price_id_env: "STRIPE_PRICE_PRO_YEARLY" },
    },
  },
  advanced: {
    name: "Avanzado",
    leads_limit: 500,
    price_usd: 149,
    prices: {
      month: { amount_usd: 149, price_id_env: "STRIPE_PRICE_ADVANCED" },
      year: { amount_usd: 1490, price_id_env: "STRIPE_PRICE_ADVANCED_YEARLY" },
    },
  },
  legacy_early_adopter: { name: "Early Adopter (Pro gratis)", leads_limit: 200, price_usd: 0 },
} as const;

// Back-compat alias: existing call sites read SUBSCRIPTION_PLANS[plan].{name,leads_limit,price_usd}.
export const SUBSCRIPTION_PLANS = PLAN_CATALOG;

export function getPriceId(tier: PlanTier, interval: BillingInterval): string {
  const envName = PLAN_CATALOG[tier].prices[interval].price_id_env;
  const value = process.env[envName];
  if (!value) {
    throw new Error(`Missing Stripe price env var: ${envName}`);
  }
  return value;
}

export function getYearlySavings(tier: PlanTier): number {
  const monthly = PLAN_CATALOG[tier].prices.month.amount_usd;
  const yearly = PLAN_CATALOG[tier].prices.year.amount_usd;
  return monthly * 12 - yearly;
}

export function getTierFromPriceId(
  priceId: string | null | undefined,
): { tier: PlanTier; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const tier of PAID_PLANS) {
    for (const interval of BILLING_INTERVALS) {
      if (process.env[PLAN_CATALOG[tier].prices[interval].price_id_env] === priceId) {
        return { tier, interval };
      }
    }
  }
  return null;
}
