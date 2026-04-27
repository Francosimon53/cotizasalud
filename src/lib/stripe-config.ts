export const STRIPE_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC!,
  pro: process.env.STRIPE_PRICE_PRO!,
  advanced: process.env.STRIPE_PRICE_ADVANCED!,
} as const;

export type PaidPlan = "basic" | "pro" | "advanced";

export const PAID_PLANS: readonly PaidPlan[] = ["basic", "pro", "advanced"];

export function planFromPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  if (priceId === STRIPE_PRICE_IDS.basic) return "basic";
  if (priceId === STRIPE_PRICE_IDS.pro) return "pro";
  if (priceId === STRIPE_PRICE_IDS.advanced) return "advanced";
  return null;
}
