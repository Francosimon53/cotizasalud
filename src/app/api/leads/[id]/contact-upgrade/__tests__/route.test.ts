import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));

import { POST } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { hashLeadToken } from "@/lib/lead-token";
import { rateLimit } from "@/lib/rate-limit";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const CLIENT_TOKEN = "test-client-token";
const CLIENT_TOKEN_HASH = hashLeadToken(CLIENT_TOKEN);

function makeRequest(body: unknown, ip = "203.0.113.20", token: string | null = CLIENT_TOKEN): any {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => {
        const n = name.toLowerCase();
        if (n === "x-forwarded-for") return ip;
        if (n === "user-agent") return "test-agent";
        if (n === "x-lead-token") return token;
        return null;
      },
    },
    url: "http://localhost:3000/api/leads/<id>/contact-upgrade",
  };
}

function makeBadJsonRequest(ip = "203.0.113.20"): any {
  return {
    json: async () => {
      throw new Error("invalid json");
    },
    headers: {
      get: (name: string) => (name.toLowerCase() === "x-forwarded-for" ? ip : null),
    },
  };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

interface DbOpts {
  lead?: {
    id: string;
    created_at: string;
    status: string;
    client_token_hash?: string | null;
  } | null;
  updateRows?: Array<{ id: string }>;
  updateError?: unknown;
}

function installDb(opts: DbOpts) {
  const { lead: leadOpt = null, updateRows = [{ id: VALID_UUID }], updateError = null } = opts;
  const lead = leadOpt ? { client_token_hash: CLIENT_TOKEN_HASH, ...leadOpt } : null;
  const updateCalls: Array<{ payload: Record<string, unknown> }> = [];
  const insertCalls: Array<Record<string, unknown>> = [];

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
              eq: () => ({
                in: () => ({
                  select: async () => ({
                    data: updateError ? null : updateRows,
                    error: updateError,
                  }),
                }),
              }),
            };
          },
        };
      }
      if (table === "lead_activity") {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertCalls.push(payload);
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

const recentTs = () => new Date(Date.now() - 30_000).toISOString();
// A client who spends 20 minutes comparing plans — must be ACCEPTED now that
// the 10-minute window is gone.
const slowClientTs = () => new Date(Date.now() - 20 * 60 * 1000).toISOString();
const staleTs = () => new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
});

describe("POST /api/leads/[id]/contact-upgrade", () => {
  it("returns 400 when the URL id is not a UUID", async () => {
    const res = await POST(makeRequest({}), makeParams("not-a-uuid"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid lead reference/i);
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await POST(makeBadJsonRequest(), makeParams(VALID_UUID));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid request body/i);
  });

  it("returns 400 (vague) when the lead does not exist", async () => {
    installDb({ lead: null });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid lead reference/i);
  });

  it("returns 400 (vague) when the lead is older than 72h, even with a valid token", async () => {
    const db = installDb({ lead: { id: VALID_UUID, created_at: staleTs(), status: "browsing" } });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(400);
    expect(db._updateCalls).toHaveLength(0);
  });

  it("accepts a slow client: 20-minute-old lead with a valid token (old 10-min window is gone)", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: slowClientTs(), status: "browsing" },
    });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(200);
    expect(db._updateCalls).toHaveLength(1);
  });

  it.each([
    ["missing", null],
    ["wrong", "some-other-token"],
  ])("returns 400 (vague) and does NOT update when x-lead-token is %s", async (_label, token) => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: recentTs(), status: "browsing" },
    });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }, "203.0.113.20", token),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid lead reference/i);
    expect(db._updateCalls).toHaveLength(0);
    expect(db._insertCalls).toHaveLength(0);
  });

  it("returns 400 (vague) when the lead has no stored token hash (legacy row)", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: recentTs(), status: "browsing", client_token_hash: null },
    });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(400);
    expect(db._updateCalls).toHaveLength(0);
  });

  it("transitions a lead from 'browsing' to 'new' on the happy path", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: recentTs(), status: "browsing" },
    });

    const res = await POST(
      makeRequest({
        contactName: "Maria Lopez",
        contactPhone: "(239) 555-1234",
        contactEmail: "maria@example.com",
        firstName: "Maria",
        lastName: "Lopez",
      }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(200);
    expect(db._updateCalls).toHaveLength(1);
    expect(db._updateCalls[0].payload.status).toBe("new");
    expect(db._updateCalls[0].payload.contact_name).toBe("Maria Lopez");
    expect(db._insertCalls).toHaveLength(1);
  });

  it("transitions a lead from 'quoted' to 'new' (real cotizar flow: plan-select runs first)", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: recentTs(), status: "quoted" },
    });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(200);
    expect(db._updateCalls[0].payload.status).toBe("new");
  });

  it("returns 400 when the lead has already been claimed by an agent (status 'new')", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: recentTs(), status: "new" },
    });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(400);
    expect(db._updateCalls).toHaveLength(0);
  });

  it.each(["contacted", "enrolled", "lost"])(
    "returns 400 when the lead is in terminal/agent status '%s'",
    async (status) => {
      const db = installDb({
        lead: { id: VALID_UUID, created_at: recentTs(), status },
      });

      const res = await POST(
        makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
        makeParams(VALID_UUID)
      );

      expect(res.status).toBe(400);
      expect(db._updateCalls).toHaveLength(0);
    }
  );

  it("returns 400 when the atomic UPDATE matches zero rows (race condition)", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: recentTs(), status: "browsing" },
      updateRows: [],
    });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(400);
    expect(db._updateCalls).toHaveLength(1);
    expect(db._insertCalls).toHaveLength(0);
  });

  it("returns 429 when the rate limiter reports the IP is limited", async () => {
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

    const res = await POST(makeRequest({}), makeParams(VALID_UUID));

    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("contact-upgrade:203.0.113.20", {
      max: 5,
      windowMs: 60_000,
    });
  });
});
