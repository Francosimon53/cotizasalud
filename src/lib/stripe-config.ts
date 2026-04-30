// Deprecated shim — kept transiently while call sites migrate to
// subscription-plans.ts. Will be removed in the webhook commit.
import { PLAN_CATALOG, getTierFromPriceId, type PlanTier } from "./subscription-plans";

export type PaidPlan = PlanTier;
export const PAID_PLANS: readonly PaidPlan[] = ["basic", "pro", "advanced"];

export const STRIPE_PRICE_IDS = {
  basic: process.env[PLAN_CATALOG.basic.prices.month.price_id_env]!,
  pro: process.env[PLAN_CATALOG.pro.prices.month.price_id_env]!,
  advanced: process.env[PLAN_CATALOG.advanced.prices.month.price_id_env]!,
} as const;

export function planFromPriceId(priceId: string | null | undefined): PaidPlan | null {
  return getTierFromPriceId(priceId)?.tier ?? null;
}
