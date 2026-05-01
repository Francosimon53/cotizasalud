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
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));

import { POST } from "../route";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

type Agent = { id: string; slug: string; is_active?: boolean };

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

function mockAuthUser(user: { id: string } | null) {
  (createServerAuthClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
}

interface DbMockOpts {
  agent?: Agent | null;
  existing?: { id: string } | null;
  insertedId?: string;
  insertError?: unknown;
}

function makeDbMock(opts: DbMockOpts) {
  const { agent = null, existing = null, insertedId = "lead-1", insertError = null } = opts;
  const insertCalls: Record<string, unknown>[] = [];

  const db = {
    from: vi.fn((table: string) => {
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: agent, error: agent ? null : { code: "PGRST116" } }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  single: async () => ({ data: existing, error: null }),
                }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            insertCalls.push(payload);
            return {
              select: () => ({
                single: async () =>
                  insertError
                    ? { data: null, error: insertError }
                    : { data: { id: insertedId }, error: null },
              }),
            };
          },
        };
      }
      if (table === "renewal_reminders") {
        return {
          insert: vi.fn(async () => ({ data: null, error: null })),
        };
      }
      return {};
    }),
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return { db, insertCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
});

describe("POST /api/leads/import", () => {
  it("returns 401 when no auth user is present", async () => {
    mockAuthUser(null);

    const res = await POST(makeRequest({ name: "Maria", phone: "1234567890" }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/auth/i);
  });

  it("returns 403 when the auth user has no linked agent profile", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: null });

    const res = await POST(makeRequest({ name: "Maria", phone: "1234567890" }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/no agent profile/i);
  });

  it("returns 403 when the linked agent is inactive", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: { id: "a1", slug: "alice", is_active: false } });

    const res = await POST(makeRequest({ name: "Maria", phone: "1234567890" }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/inactive/i);
  });

  it("creates a lead and uses agent_id/agent_slug derived from the authenticated user", async () => {
    mockAuthUser({ id: "u1" });
    const { insertCalls } = makeDbMock({
      agent: { id: "a1", slug: "alice", is_active: true },
      existing: null,
      insertedId: "lead-99",
    });

    const res = await POST(
      makeRequest({
        name: "Maria Lopez",
        phone: "(239) 555-1234",
        email: "maria@example.com",
        planName: "Ambetter Gold",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, leadId: "lead-99" });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].agent_id).toBe("a1");
    expect(insertCalls[0].agent_slug).toBe("alice");
    expect(insertCalls[0].contact_phone).toBe("2395551234"); // digits only
  });

  it("ignores agent_slug from the body (anti-spoofing)", async () => {
    mockAuthUser({ id: "u1" });
    const { insertCalls } = makeDbMock({
      agent: { id: "a1", slug: "alice", is_active: true },
      existing: null,
      insertedId: "lead-99",
    });

    const res = await POST(
      makeRequest({
        name: "Maria",
        phone: "1234567890",
        agentSlug: "victim-agent",
        agent_slug: "victim-agent",
      })
    );

    expect(res.status).toBe(200);
    expect(insertCalls[0].agent_slug).toBe("alice");
    expect(insertCalls[0].agent_id).toBe("a1");
  });

  it("returns 429 when the rate limiter reports the user is limited", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: { id: "a1", slug: "alice", is_active: true } });
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

    const res = await POST(makeRequest({ name: "Maria", phone: "1234567890" }));

    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("import:u1", {
      max: 10,
      windowMs: 60 * 60_000,
    });
  });
});
