import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Module-level mocks. These must be hoisted above the route import so the
// route picks up the mocked dependencies when its module loads.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));
vi.mock("@/lib/supabase-auth", () => ({
  createServerAuthClient: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/stripe-client", () => ({
  stripe: {
    customers: { create: vi.fn() },
    subscriptions: { list: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}));

import { POST } from "../route";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { TRIAL_DAYS } from "@/lib/subscription-plans";

const AGENT = { id: "agent-1", email: "agente@example.com", stripe_customer_id: "cus_existing" };

const PRICE_ENV = {
  STRIPE_PRICE_BASIC: "price_basic_month_test",
  STRIPE_PRICE_BASIC_YEARLY: "price_basic_year_test",
  STRIPE_PRICE_PRO: "price_pro_month_test",
  STRIPE_PRICE_PRO_YEARLY: "price_pro_year_test",
  STRIPE_PRICE_ADVANCED: "price_advanced_month_test",
  STRIPE_PRICE_ADVANCED_YEARLY: "price_advanced_year_test",
} as const;

function makeRequest(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => "https://enrollsalud.com" },
    url: "https://enrollsalud.com/api/stripe/create-checkout-session",
  } as unknown as Parameters<typeof POST>[0];
}

function mockAuthUser(user: { id: string; email?: string } | null) {
  (createServerAuthClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
}

function installDb(agent: Record<string, unknown> | null) {
  const updateCalls: Record<string, unknown>[] = [];
  const db = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: agent, error: agent ? null : { code: "PGRST116" } }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updateCalls.push(payload);
        return { eq: async () => ({ error: null }) };
      },
    })),
    _updateCalls: updateCalls,
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

function mockSubscriptions(subs: Array<{ id: string; status: string }>) {
  (stripe.subscriptions.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: subs,
  });
}

function lastSessionPayload(): Record<string, any> {
  const mock = stripe.checkout.sessions.create as unknown as ReturnType<typeof vi.fn>;
  expect(mock).toHaveBeenCalledTimes(1);
  return mock.mock.calls[0][0];
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  for (const [k, v] of Object.entries(PRICE_ENV)) {
    process.env[k] = v;
  }
  mockAuthUser({ id: "user-1", email: "agente@example.com" });
  (stripe.checkout.sessions.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  });
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("POST /api/stripe/create-checkout-session — trial de primera suscripción", () => {
  it("includes trial_period_days on the agent's first checkout (customer with no subscriptions)", async () => {
    installDb(AGENT);
    mockSubscriptions([]);

    const res = await POST(makeRequest({ plan: "basic", interval: "month" }));

    expect(res.status).toBe(200);
    expect(stripe.subscriptions.list).toHaveBeenCalledWith({
      customer: "cus_existing",
      status: "all",
      limit: 1,
    });
    expect(lastSessionPayload().subscription_data.trial_period_days).toBe(TRIAL_DAYS);
  });

  it("includes trial_period_days for a brand-new customer without calling subscriptions.list", async () => {
    installDb({ ...AGENT, stripe_customer_id: null });
    (stripe.customers.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cus_new",
    });

    const res = await POST(makeRequest({ plan: "pro", interval: "year" }));

    expect(res.status).toBe(200);
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    const payload = lastSessionPayload();
    expect(payload.customer).toBe("cus_new");
    expect(payload.subscription_data.trial_period_days).toBe(TRIAL_DAYS);
  });

  it.each([
    ["active", "active"],
    ["canceled", "canceled"],
    ["trialing", "trialing"],
    ["past_due", "past_due"],
  ])("omits the trial when the customer already had a subscription (status %s)", async (_label, status) => {
    installDb(AGENT);
    mockSubscriptions([{ id: "sub_prior", status }]);

    const res = await POST(makeRequest({ plan: "basic", interval: "month" }));

    expect(res.status).toBe(200);
    const payload = lastSessionPayload();
    expect(payload.subscription_data).not.toHaveProperty("trial_period_days");
    // Existing behavior stays intact: metadata still flows to the subscription.
    expect(payload.subscription_data.metadata).toEqual({
      agent_id: AGENT.id,
      plan: "basic",
      interval: "month",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthUser(null);
    const res = await POST(makeRequest({ plan: "basic", interval: "month" }));
    expect(res.status).toBe(401);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the agent record is missing", async () => {
    installDb(null);
    const res = await POST(makeRequest({ plan: "basic", interval: "month" }));
    expect(res.status).toBe(404);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
