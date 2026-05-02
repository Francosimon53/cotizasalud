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

function makeRequest(body: unknown, ip = "203.0.113.30"): any {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => (name.toLowerCase() === "x-forwarded-for" ? ip : null),
    },
  };
}

interface DbOpts {
  lead?: { id: string; created_at: string; status: string } | null;
  updateRows?: Array<{ id: string }>;
}

function installDb(opts: DbOpts) {
  const { lead = null, updateRows = [{ id: VALID_UUID }] } = opts;
  const updateCalls: Array<{ payload: Record<string, unknown> }> = [];

  const db = {
    from: vi.fn(() => ({
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
              select: async () => ({ data: updateRows, error: null }),
            }),
          }),
        };
      },
    })),
    _updateCalls: updateCalls,
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

describe("POST /api/plan-select", () => {
  it("returns 400 when leadId is malformed", async () => {
    const res = await POST(makeRequest({ leadId: "not-a-uuid", plan: { name: "X" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when plan is missing", async () => {
    const res = await POST(makeRequest({ leadId: VALID_UUID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/plan/i);
  });

  it("returns 400 when the lead is older than the recency window", async () => {
    installDb({ lead: { id: VALID_UUID, created_at: staleTs(), status: "browsing" } });

    const res = await POST(makeRequest({ leadId: VALID_UUID, plan: { name: "X" } }));

    expect(res.status).toBe(400);
  });

  it("transitions a lead from 'browsing' to 'quoted' on the happy path", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: recentTs(), status: "browsing" },
    });

    const res = await POST(
      makeRequest({
        leadId: VALID_UUID,
        plan: { id: "p1", name: "Ambetter Gold", afterSubsidy: 85 },
      })
    );

    expect(res.status).toBe(200);
    expect(db._updateCalls).toHaveLength(1);
    expect(db._updateCalls[0].payload.status).toBe("quoted");
    expect(db._updateCalls[0].payload.selected_plan_name).toBe("Ambetter Gold");
  });

  it("allows re-selection: lead already 'quoted' stays 'quoted'", async () => {
    const db = installDb({
      lead: { id: VALID_UUID, created_at: recentTs(), status: "quoted" },
    });

    const res = await POST(
      makeRequest({ leadId: VALID_UUID, plan: { id: "p2", name: "Molina Silver" } })
    );

    expect(res.status).toBe(200);
    expect(db._updateCalls[0].payload.status).toBe("quoted");
    expect(db._updateCalls[0].payload.selected_plan_name).toBe("Molina Silver");
  });

  it.each(["new", "contacted", "enrolled", "lost"])(
    "returns 400 when the lead has been claimed by an agent (status '%s')",
    async (status) => {
      const db = installDb({
        lead: { id: VALID_UUID, created_at: recentTs(), status },
      });

      const res = await POST(makeRequest({ leadId: VALID_UUID, plan: { name: "X" } }));

      expect(res.status).toBe(400);
      expect(db._updateCalls).toHaveLength(0);
    }
  );

  it("returns 429 when the rate limiter reports the IP is limited", async () => {
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

    const res = await POST(makeRequest({ leadId: VALID_UUID, plan: { name: "X" } }));

    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("plan-select:203.0.113.30", {
      max: 5,
      windowMs: 60_000,
    });
  });
});
