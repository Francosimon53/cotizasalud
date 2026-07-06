import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/auth/require-agent", () => ({
  requireAuthenticatedAgent: vi.fn(),
}));

import { DELETE, GET, PATCH } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { NextResponse } from "next/server";

type Agent = { id: string; slug: string; is_active?: boolean };

function makeRequest(): any {
  return {} as any;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function setAuthOk(agent: Agent) {
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

function installDb(opts: {
  lead?: { id?: string; agent_id?: string } | null;
  activity?: unknown[];
  deleteError?: unknown;
}) {
  const { lead = null, activity = [], deleteError = null } = opts;
  const deleteCalls: { table: string; eq: [string, unknown] }[] = [];

  const db = {
    from: vi.fn((table: string) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: lead, error: lead ? null : { code: "PGRST116" } }),
            }),
          }),
          delete: () => ({
            eq: (col: string, val: unknown) => {
              deleteCalls.push({ table: "leads", eq: [col, val] });
              return Promise.resolve({ data: null, error: deleteError });
            },
          }),
        };
      }
      if (table === "lead_activity") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: activity, error: null }),
            }),
          }),
          delete: () => ({
            eq: (col: string, val: unknown) => {
              deleteCalls.push({ table: "lead_activity", eq: [col, val] });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      return {};
    }),
    _deleteCalls: deleteCalls,
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/leads/[id]", () => {
  it("returns 401 when no auth user is present", async () => {
    setAuthError(401, "Authentication required");

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(401);
  });

  it("returns 403 when the auth user has no linked agent", async () => {
    setAuthError(403, "No agent profile linked to this account");

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(403);
  });

  it("returns 200 with the lead when ownership matches", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({
      lead: { id: "lead-1", agent_id: "a1" },
      activity: [{ id: "act-1", lead_id: "lead-1" }],
    });

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lead.id).toBe("lead-1");
    expect(body.activity).toHaveLength(1);
  });

  it("returns 403 (NOT 404) when the lead exists but belongs to another agent", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({
      lead: { id: "lead-1", agent_id: "victim-agent" },
    });

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("returns 404 when the lead does not exist", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ lead: null });

    const res = await GET(makeRequest(), makeParams("missing"));

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/leads/[id]", () => {
  it("returns 403 and does NOT delete when ownership mismatches (anti-IDOR)", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installDb({
      lead: { id: "lead-1", agent_id: "victim-agent" },
    });

    const res = await DELETE(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(403);
    expect(db._deleteCalls).toHaveLength(0);
  });

  it("deletes the lead and its activity when ownership matches", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installDb({
      lead: { id: "lead-1", agent_id: "a1" },
    });

    const res = await DELETE(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(200);
    const tables = db._deleteCalls.map((c) => c.table);
    expect(tables).toEqual(["lead_activity", "leads"]);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/leads/[id] — product_track routing
// ---------------------------------------------------------------------------

function makePatchRequest(body: unknown): any {
  return { json: async () => body } as any;
}

function installPatchDb(opts: { lead?: { agent_id: string; selected_plan?: unknown } | null }) {
  const { lead = null } = opts;
  const updateCalls: Array<Record<string, unknown>> = [];

  const db = {
    from: vi.fn((table: string) => {
      if (table !== "leads") return {};
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: lead, error: lead ? null : { code: "PGRST116" } }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          updateCalls.push(payload);
          return { eq: async () => ({ data: null, error: null }) };
        },
      };
    }),
    _updateCalls: updateCalls,
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

describe("PATCH /api/leads/[id] — product_track", () => {
  it("returns 401 when no auth user is present", async () => {
    setAuthError(401, "Authentication required");

    const res = await PATCH(makePatchRequest({ productTrack: "private" }), makeParams("lead-1"));

    expect(res.status).toBe(401);
  });

  it("returns 403 and does NOT update when ownership mismatches (anti-IDOR)", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installPatchDb({ lead: { agent_id: "victim-agent" } });

    const res = await PATCH(makePatchRequest({ productTrack: "private" }), makeParams("lead-1"));

    expect(res.status).toBe(403);
    expect(db._updateCalls).toHaveLength(0);
  });

  it("returns 400 for a non-whitelisted productTrack without touching the row", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installPatchDb({ lead: { agent_id: "a1" } });

    const res = await PATCH(
      makePatchRequest({ productTrack: "crypto_insurance" }),
      makeParams("lead-1")
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid producttrack/i);
    expect(db._updateCalls).toHaveLength(0);
  });

  it("still returns 400 when neither plan nor productTrack is sent", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installPatchDb({ lead: { agent_id: "a1" } });

    const res = await PATCH(makePatchRequest({}), makeParams("lead-1"));

    expect(res.status).toBe(400);
  });

  it("saves a whitelisted productTrack when ownership matches, without touching the plan", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installPatchDb({ lead: { agent_id: "a1", selected_plan: { name: "Keep Me" } } });

    const res = await PATCH(
      makePatchRequest({ productTrack: "medicaid_referral" }),
      makeParams("lead-1")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.product_track).toBe("medicaid_referral");
    expect(db._updateCalls).toHaveLength(1);
    expect(db._updateCalls[0]).toEqual({ product_track: "medicaid_referral" });
  });
});
