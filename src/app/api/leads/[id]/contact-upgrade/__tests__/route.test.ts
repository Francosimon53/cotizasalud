import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));

import { POST } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

function makeRequest(body: unknown, ip = "203.0.113.20"): any {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => {
        const n = name.toLowerCase();
        if (n === "x-forwarded-for") return ip;
        if (n === "user-agent") return "test-agent";
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
  lead?: { id: string; created_at: string; status: string } | null;
  updateRows?: Array<{ id: string }>;
  updateError?: unknown;
}

function installDb(opts: DbOpts) {
  const { lead = null, updateRows = [{ id: VALID_UUID }], updateError = null } = opts;
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
const staleTs = () => new Date(Date.now() - 11 * 60 * 1000).toISOString();

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

  it("returns 400 (vague) when the lead is older than the recency window", async () => {
    installDb({ lead: { id: VALID_UUID, created_at: staleTs(), status: "browsing" } });

    const res = await POST(
      makeRequest({ contactName: "Maria", contactPhone: "1234567890" }),
      makeParams(VALID_UUID)
    );

    expect(res.status).toBe(400);
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
