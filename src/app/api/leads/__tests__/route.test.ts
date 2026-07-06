import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/resolve-agent", () => ({
  resolveAgentFromSlug: vi.fn(async () => ({ agent_id: "a1", agent_slug: "test" })),
}));
vi.mock("@/lib/normalize-slug", () => ({
  normalizeAgentSlug: vi.fn(() => ({ ok: true, slug: "test" })),
}));
vi.mock("@/lib/slug-logging", () => ({
  captureInvalidAgentSlug: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));
vi.mock("@/lib/auth/require-agent", () => ({
  requireAuthenticatedAgent: vi.fn(),
}));

import { PATCH, POST } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { hashLeadToken } from "@/lib/lead-token";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { NextResponse } from "next/server";

function makeRequest(body: unknown, ip = "203.0.113.1") {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => {
        const n = name.toLowerCase();
        if (n === "x-forwarded-for") return ip;
        if (n === "user-agent") return "test-agent";
        if (n === "origin") return "http://localhost:3000";
        return null;
      },
    },
    url: "http://localhost:3000/api/leads",
    nextUrl: { origin: "http://localhost:3000" },
  } as unknown as Parameters<typeof POST>[0];
}

function installSuccessDb() {
  const insertCalls: Array<Record<string, unknown>> = [];
  const db = {
    from: vi.fn((table: string) => {
      if (table === "leads") {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertCalls.push(payload);
            return {
              select: () => ({
                single: async () => ({ data: { id: "lead-1" }, error: null }),
              }),
            };
          },
        };
      }
      if (table === "page_views") {
        return { insert: vi.fn(async () => ({ data: null, error: null })) };
      }
      return {};
    }),
    _insertCalls: insertCalls,
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

describe("POST /api/leads — rate limiting", () => {
  it("returns 429 after the rate limit is exceeded for a single IP", async () => {
    installSuccessDb();
    const MAX = 5;
    let count = 0;
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, opts: { max: number }) => {
        count++;
        return { limited: count > opts.max };
      }
    );

    for (let i = 0; i < MAX; i++) {
      const res = await POST(makeRequest({ zipcode: "33914" }));
      expect(res.status).not.toBe(429);
    }

    const limited = await POST(makeRequest({ zipcode: "33914" }));
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);
    expect(rateLimit).toHaveBeenCalledWith("leads:203.0.113.1", { max: 5, windowMs: 60_000 });
  });
});

describe("POST /api/leads — capability token issuance", () => {
  it("returns a clientToken, stores only its SHA-256, and forwards the token to notify-lead", async () => {
    const db = installSuccessDb();
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(
      makeRequest({
        zipcode: "33914",
        county: "Lee",
        contactName: "Maria Lopez",
        contactPhone: "2395551234",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leadId).toBe("lead-1");
    expect(typeof body.clientToken).toBe("string");
    expect(body.clientToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(db._insertCalls).toHaveLength(1);
    expect(db._insertCalls[0].client_token_hash).toBe(hashLeadToken(body.clientToken));
    expect(Object.values(db._insertCalls[0])).not.toContain(body.clientToken);

    // The internal notify-lead call must carry the token, since notify-lead
    // now requires it.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [notifyUrl, notifyInit] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(notifyUrl).toContain("/api/notify-lead");
    expect((notifyInit.headers as Record<string, string>)["x-lead-token"]).toBe(body.clientToken);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/leads — auth + ownership
// ---------------------------------------------------------------------------

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

function setAuthOk(agent: { id: string; slug: string; is_active?: boolean }) {
  (requireAuthenticatedAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    agent,
    user: { id: "user-1" },
  });
}

function setAuthError(status: number, message: string) {
  (requireAuthenticatedAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    NextResponse.json({ error: message }, { status })
  );
}

function installPatchDb(opts: {
  lead?: { agent_id: string; status: string } | null;
  updateError?: unknown;
}) {
  const { lead = null, updateError = null } = opts;
  const updateCalls: Array<{ payload: Record<string, unknown> }> = [];
  const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];

  const db = {
    from: vi.fn((table: string) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: lead,
                error: lead ? null : { code: "PGRST116" },
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updateCalls.push({ payload });
            return {
              eq: async () => ({ data: null, error: updateError }),
            };
          },
        };
      }
      if (table === "lead_activity") {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertCalls.push({ table: "lead_activity", payload });
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {};
    }),
    _updateCalls: updateCalls,
    _insertCalls: insertCalls,
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

describe("PATCH /api/leads — auth + ownership", () => {
  it("returns 401 when no auth user is present", async () => {
    setAuthError(401, "Authentication required");

    const res = await PATCH(
      makeRequest({ leadId: VALID_UUID, status: "contacted", note: "x" })
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when the auth user has no linked agent", async () => {
    setAuthError(403, "No agent profile linked to this account");

    const res = await PATCH(
      makeRequest({ leadId: VALID_UUID, status: "contacted", note: "x" })
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 when leadId is malformed", async () => {
    setAuthOk({ id: "a1", slug: "alice" });

    const res = await PATCH(
      makeRequest({ leadId: "not-a-uuid", status: "contacted", note: "x" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid leadid/i);
  });

  it("returns 404 when the lead does not exist", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installPatchDb({ lead: null });

    const res = await PATCH(
      makeRequest({ leadId: VALID_UUID, status: "contacted", note: "x" })
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 (NOT 404) and does NOT update when ownership mismatches (anti-IDOR)", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installPatchDb({
      lead: { agent_id: "victim-agent", status: "new" },
    });

    const res = await PATCH(
      makeRequest({ leadId: VALID_UUID, status: "contacted", note: "Reached" })
    );

    expect(res.status).toBe(403);
    expect(db._updateCalls).toHaveLength(0);
    expect(db._insertCalls).toHaveLength(0);
  });

  it("updates the lead when ownership matches", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installPatchDb({
      lead: { agent_id: "a1", status: "new" },
    });

    const res = await PATCH(
      makeRequest({ leadId: VALID_UUID, status: "contacted", note: "Reached" })
    );

    expect(res.status).toBe(200);
    expect(db._updateCalls).toHaveLength(1);
    expect(db._updateCalls[0].payload.status).toBe("contacted");
    expect(db._insertCalls).toHaveLength(1);
    expect(db._insertCalls[0].table).toBe("lead_activity");
  });
});
