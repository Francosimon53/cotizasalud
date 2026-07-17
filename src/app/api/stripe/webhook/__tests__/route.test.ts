import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Module-level mocks. These must be hoisted above the route import so the
// route picks up the mocked dependencies when its module loads.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => "sig_test" })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/stripe-client", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
  },
}));

import { POST } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { PLAN_CATALOG } from "@/lib/subscription-plans";

const PRICE_ENV = {
  STRIPE_PRICE_BASIC: "price_basic_month_test",
  STRIPE_PRICE_BASIC_YEARLY: "price_basic_year_test",
  STRIPE_PRICE_PRO: "price_pro_month_test",
  STRIPE_PRICE_PRO_YEARLY: "price_pro_year_test",
  STRIPE_PRICE_ADVANCED: "price_advanced_month_test",
  STRIPE_PRICE_ADVANCED_YEARLY: "price_advanced_year_test",
} as const;

function makeRequest() {
  return { text: async () => "{}" } as unknown as Parameters<typeof POST>[0];
}

function installDb() {
  const updates: Array<{ payload: Record<string, unknown>; customerId: string }> = [];
  const db = {
    from: vi.fn(() => ({
      update: (payload: Record<string, unknown>) => ({
        eq: async (_col: string, customerId: string) => {
          updates.push({ payload, customerId });
          return { error: null };
        },
      }),
    })),
    _updates: updates,
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

function mockEvent(type: string, object: Record<string, unknown>) {
  (stripe.webhooks.constructEvent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    type,
    data: { object },
  });
}

function subscription(status: string, priceId = "price_pro_month_test") {
  return {
    id: "sub_1",
    customer: "cus_1",
    status,
    items: {
      data: [
        {
          price: { id: priceId },
          current_period_start: 1_752_000_000,
          current_period_end: 1_754_600_000,
        },
      ],
    },
  };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  for (const [k, v] of Object.entries(PRICE_ENV)) {
    process.env[k] = v;
  }
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("POST /api/stripe/webhook — trialing grants the same access as active", () => {
  it.each(["trialing", "active"])(
    "syncs plan, limits and status when the subscription is %s",
    async (status) => {
      const db = installDb();
      mockEvent("customer.subscription.created", subscription(status));

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      expect(db._updates).toHaveLength(1);
      const { payload, customerId } = db._updates[0];
      expect(customerId).toBe("cus_1");
      expect(payload.subscription_status).toBe(status);
      expect(payload.subscription_plan).toBe("pro");
      expect(payload.leads_limit_monthly).toBe(PLAN_CATALOG.pro.leads_limit);
      expect(payload.stripe_subscription_id).toBe("sub_1");
    }
  );

  it("moves trialing → active on subscription.updated when the first invoice is paid", async () => {
    const db = installDb();
    mockEvent("customer.subscription.updated", subscription("active"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(db._updates[0].payload.subscription_status).toBe("active");
  });
});
