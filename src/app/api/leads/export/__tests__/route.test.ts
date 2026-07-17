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

import { GET } from "../route";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

type Agent = { id: string; slug: string; is_active?: boolean };

function mockAuthUser(user: { id: string } | null) {
  (createServerAuthClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
}

interface DbMockOpts {
  agent?: Agent | null;
  leads?: Record<string, unknown>[];
  leadsError?: unknown;
}

function makeDbMock(opts: DbMockOpts) {
  const { agent = null, leads = [], leadsError = null } = opts;
  const leadsEqCalls: [string, unknown][] = [];

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
            eq: (col: string, val: unknown) => {
              leadsEqCalls.push([col, val]);
              return {
                order: async () => ({ data: leadsError ? null : leads, error: leadsError }),
              };
            },
          }),
        };
      }
      return {};
    }),
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return { db, leadsEqCalls };
}

const baseLead = {
  first_name: "María",
  last_name: "García",
  contact_name: "",
  contact_phone: "2395551234",
  contact_email: "maria@example.com",
  selected_plan_name: "Ambetter Gold",
  selected_premium: 45.5,
  enrollment_date: "2026-01-01",
  status: "enrolled",
  zipcode: "33101",
  created_at: "2026-01-01T12:00:00Z",
  utm_source: "whatsapp",
  utm_medium: null,
  utm_campaign: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
});

describe("GET /api/leads/export", () => {
  it("returns 401 when no auth user is present", async () => {
    mockAuthUser(null);

    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/auth/i);
  });

  it("returns 403 when the auth user has no linked agent profile", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: null });

    const res = await GET();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/no agent profile/i);
  });

  it("returns 403 when the linked agent is inactive", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: { id: "a1", slug: "alice", is_active: false } });

    const res = await GET();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/inactive/i);
  });

  it("filters leads by the authenticated agent's id (ownership)", async () => {
    mockAuthUser({ id: "u1" });
    const { leadsEqCalls } = makeDbMock({
      agent: { id: "a1", slug: "alice", is_active: true },
      leads: [baseLead],
    });

    const res = await GET();

    expect(res.status).toBe(200);
    // The only filter on the leads query is agent_id = session agent's id —
    // never a value from the request.
    expect(leadsEqCalls).toEqual([["agent_id", "a1"]]);
    const text = await res.text();
    expect(text).toContain("María");
    expect(text).not.toContain("otro-agente");
  });

  it("responds as a CSV attachment with a UTF-8 BOM", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({
      agent: { id: "a1", slug: "alice", is_active: true },
      leads: [baseLead],
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="leads-enrollsalud-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(res.headers.get("X-Total-Count")).toBe("1");

    // res.text() strips a leading BOM during UTF-8 decoding, so assert on the
    // raw bytes: EF BB BF is the UTF-8 encoding of U+FEFF.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM first, before headers
    expect(text.slice(1).startsWith("first_name,last_name,phone,email,")).toBe(true);
  });

  it("escapes fields containing commas and quotes per RFC 4180", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({
      agent: { id: "a1", slug: "alice", is_active: true },
      leads: [
        {
          ...baseLead,
          first_name: 'José "Pepe"',
          selected_plan_name: "Ambetter, Gold Plus",
        },
      ],
    });

    const res = await GET();
    const text = await res.text();

    // Embedded quotes doubled, whole field quoted.
    expect(text).toContain('"José ""Pepe"""');
    // Comma-bearing field quoted so it can't split the row.
    expect(text).toContain('"Ambetter, Gold Plus"');
    // The data row still has exactly as many columns as the header.
    // (res.text() already stripped the BOM.)
    const [headerLine, dataLine] = text.split("\r\n");
    const count = (line: string) =>
      line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).length;
    expect(count(dataLine)).toBe(count(headerLine));
  });

  it("falls back to splitting contact_name when first/last are empty", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({
      agent: { id: "a1", slug: "alice", is_active: true },
      leads: [
        {
          ...baseLead,
          first_name: "",
          last_name: "",
          contact_name: "Ana María López",
        },
      ],
    });

    const res = await GET();
    const text = await res.text();

    expect(text).toContain("Ana,María López");
  });

  it("returns 429 when the rate limiter reports the user is limited", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: { id: "a1", slug: "alice", is_active: true } });
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

    const res = await GET();

    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("export:u1", {
      max: 30,
      windowMs: 60 * 60_000,
    });
  });

  it("returns 500 when the leads query fails", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({
      agent: { id: "a1", slug: "alice", is_active: true },
      leadsError: { message: "boom" },
    });

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
