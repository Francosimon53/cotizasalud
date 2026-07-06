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

function makeRequest(body: unknown, ip = "203.0.113.3", token: string | null = CLIENT_TOKEN) {
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
  } as unknown as Parameters<typeof POST>[0];
}

function installDb(opts: {
  lead?: { id: string; created_at: string; client_token_hash?: string | null } | null;
} = {}) {
  const { lead: leadOpt = null } = opts;
  const lead = leadOpt ? { client_token_hash: CLIENT_TOKEN_HASH, ...leadOpt } : null;
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
        };
      }
      return {
        insert: (payload: Record<string, unknown>) => {
          insertCalls.push(payload);
          return {
            select: () => ({
              single: async () => ({ data: { id: "consent-1" }, error: null }),
            }),
          };
        },
      };
    }),
    _insertCalls: insertCalls,
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

function installSuccessDb() {
  return installDb();
}

const recentTs = () => new Date(Date.now() - 30_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
});

describe("POST /api/consents — rate limiting", () => {
  it("returns 429 after the rate limit is exceeded for a single IP", async () => {
    installSuccessDb();
    const MAX = 3;
    let count = 0;
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, opts: { max: number }) => {
        count++;
        return { limited: count > opts.max };
      }
    );

    for (let i = 0; i < MAX; i++) {
      const res = await POST(makeRequest({ consumerName: "Maria", consentDate: "2026-05-01" }));
      expect(res.status).not.toBe(429);
    }

    const limited = await POST(makeRequest({ consumerName: "Maria", consentDate: "2026-05-01" }));
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);
    expect(rateLimit).toHaveBeenCalledWith("consents:203.0.113.3", { max: 3, windowMs: 300_000 });
  });
});

describe("POST /api/consents — lead capability token", () => {
  it("inserts a standalone consent (no leadId) without any token", async () => {
    const db = installDb();

    const res = await POST(
      makeRequest({ consumerName: "Maria", consentDate: "2026-05-01" }, "203.0.113.3", null)
    );

    expect(res.status).toBe(200);
    expect(db._insertCalls).toHaveLength(1);
    expect(db._insertCalls[0].lead_id).toBeNull();
  });

  it("inserts and links the consent when leadId comes with a valid token", async () => {
    const db = installDb({ lead: { id: VALID_UUID, created_at: recentTs() } });

    const res = await POST(
      makeRequest({ leadId: VALID_UUID, consumerName: "Maria", consentDate: "2026-05-01" })
    );

    expect(res.status).toBe(200);
    expect(db._insertCalls).toHaveLength(1);
    expect(db._insertCalls[0].lead_id).toBe(VALID_UUID);
  });

  it("accepts a slow client: 20-minute-old lead with a valid token", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
    });

    const res = await POST(
      makeRequest({ leadId: VALID_UUID, consumerName: "Maria", consentDate: "2026-05-01" })
    );

    expect(res.status).toBe(200);
    expect(db._insertCalls).toHaveLength(1);
  });

  it.each([
    ["missing", null],
    ["wrong", "some-other-token"],
  ])("returns 400 (vague) and does NOT insert when leadId comes and x-lead-token is %s", async (_label, token) => {
    const db = installDb({ lead: { id: VALID_UUID, created_at: recentTs() } });

    const res = await POST(
      makeRequest(
        { leadId: VALID_UUID, consumerName: "Maria", consentDate: "2026-05-01" },
        "203.0.113.3",
        token
      )
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid lead reference/i);
    expect(db._insertCalls).toHaveLength(0);
  });

  it("returns 400 (vague) and does NOT insert when the lead is older than 72h", async () => {
    const db = installDb({
      lead: {
        id: VALID_UUID,
        created_at: new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(),
      },
    });

    const res = await POST(
      makeRequest({ leadId: VALID_UUID, consumerName: "Maria", consentDate: "2026-05-01" })
    );

    expect(res.status).toBe(400);
    expect(db._insertCalls).toHaveLength(0);
  });

  it("returns 400 (vague) and does NOT insert when the lead does not exist", async () => {
    const db = installDb({ lead: null });

    const res = await POST(
      makeRequest({ leadId: VALID_UUID, consumerName: "Maria", consentDate: "2026-05-01" })
    );

    expect(res.status).toBe(400);
    expect(db._insertCalls).toHaveLength(0);
  });

  it("returns 400 when leadId is not a UUID", async () => {
    const db = installDb();

    const res = await POST(
      makeRequest({ leadId: "not-a-uuid", consumerName: "Maria", consentDate: "2026-05-01" })
    );

    expect(res.status).toBe(400);
    expect(db._insertCalls).toHaveLength(0);
  });
});
