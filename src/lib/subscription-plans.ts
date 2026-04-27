export const SUBSCRIPTION_PLANS = {
  trial: { name: "Trial", leads_limit: 200, price_usd: 0 },
  basic: { name: "Básico", leads_limit: 50, price_usd: 29 },
  pro: { name: "Pro", leads_limit: 200, price_usd: 79 },
  advanced: { name: "Avanzado", leads_limit: 500, price_usd: 149 },
  legacy_early_adopter: { name: "Early Adopter (Pro gratis)", leads_limit: 200, price_usd: 0 },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing";

export const TRIAL_DAYS = 14;
