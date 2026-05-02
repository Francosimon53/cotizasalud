import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/auth/require-agent", () => ({
  requireAuthenticatedAgent: vi.fn(),
}));

import { POST } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { NextResponse } from "next/server";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

function makeRequest(body: unknown): any {
  return {
    json: async () => body,
    headers: { get: () => null },
  };
}

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

function installDb(opts: { lead?: { agent_id: string } | null }) {
  const { lead = null } = opts;
  const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const updateCalls: Array<{ payload: Record<string, unknown> }> = [];

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
            return { eq: async () => ({ data: null, error: null }) };
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
    _insertCalls: insertCalls,
    _updateCalls: updateCalls,
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/leads/note", () => {
  it("returns 401 when no auth user is present", async () => {
    setAuthError(401, "Authentication required");

    const res = await POST(makeRequest({ leadId: VALID_UUID, note: "x" }));

    expect(res.status).toBe(401);
  });

  it("returns 403 when the auth user has no linked agent", async () => {
    setAuthError(403, "No agent profile linked to this account");

    const res = await POST(makeRequest({ leadId: VALID_UUID, note: "x" }));

    expect(res.status).toBe(403);
  });

  it("returns 400 when leadId is malformed", async () => {
    setAuthOk({ id: "a1", slug: "alice" });

    const res = await POST(makeRequest({ leadId: "not-a-uuid", note: "x" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when both note and followup date are missing", async () => {
    setAuthOk({ id: "a1", slug: "alice" });

    const res = await POST(makeRequest({ leadId: VALID_UUID }));

    expect(res.status).toBe(400);
  });

  it("returns 404 when the lead does not exist", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ lead: null });

    const res = await POST(makeRequest({ leadId: VALID_UUID, note: "Hello" }));

    expect(res.status).toBe(404);
  });

  it("returns 403 (NOT 404) and does NOT insert when ownership mismatches (anti-IDOR)", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installDb({ lead: { agent_id: "victim-agent" } });

    const res = await POST(makeRequest({ leadId: VALID_UUID, note: "Spam" }));

    expect(res.status).toBe(403);
    expect(db._insertCalls).toHaveLength(0);
    expect(db._updateCalls).toHaveLength(0);
  });

  it("inserts the activity row when ownership matches", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    const db = installDb({ lead: { agent_id: "a1" } });

    const res = await POST(
      makeRequest({ leadId: VALID_UUID, note: "Called the consumer" })
    );

    expect(res.status).toBe(200);
    expect(db._insertCalls).toHaveLength(1);
    expect(db._insertCalls[0].payload.note).toBe("Called the consumer");
    expect(db._insertCalls[0].payload.action).toBe("note_added");
  });
});
