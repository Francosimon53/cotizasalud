import { beforeEach, describe, expect, it, vi } from "vitest";

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
    checkout: { sessions: { create: vi.fn() } },
  },
}));

import { POST } from "../route";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { TRIAL_DAYS } from "@/lib/subscription-plans";

const sessionsCreate = stripe.checkout.sessions.create as unknown as ReturnType<typeof vi.fn>;

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

interface AgentRow {
  id: string;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

function makeDbMock(agent: AgentRow | null) {
  const db = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: agent, error: agent ? null : { code: "PGRST116" } }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    })),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

const baseAgent: AgentRow = {
  id: "a1",
  email: "agente@example.com",
  stripe_customer_id: "cus_123",
  stripe_subscription_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s/abc" });
  // getPriceId reads these at request time and throws (→ 500) if unset.
  process.env.STRIPE_PRICE_BASIC = "price_basic_m";
  process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_y";
});

describe("POST /api/stripe/create-checkout-session", () => {
  it("returns 401 when no auth user is present", async () => {
    mockAuthUser(null);

    const res = await POST(makeRequest({ plan: "basic", interval: "month" }));

    expect(res.status).toBe(401);
  });

  it("passes the 14-day trial on the agent's first paid subscription", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock(baseAgent);

    const res = await POST(makeRequest({ plan: "basic", interval: "month" }));

    expect(res.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.subscription_data.trial_period_days).toBe(TRIAL_DAYS);
    expect(TRIAL_DAYS).toBe(14);
  });

  it("omits the trial when the agent already had a Stripe subscription", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ ...baseAgent, stripe_subscription_id: "sub_existing" });

    const res = await POST(makeRequest({ plan: "pro", interval: "year" }));

    expect(res.status).toBe(200);
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.subscription_data.trial_period_days).toBeUndefined();
    // Subscription metadata (webhook correlation) must survive either way.
    expect(args.subscription_data.metadata).toEqual({
      agent_id: "a1",
      plan: "pro",
      interval: "year",
    });
  });

  it("rejects an invalid plan with 400 before touching Stripe", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock(baseAgent);

    const res = await POST(makeRequest({ plan: "hackerman", interval: "month" }));

    expect(res.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});
