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
  /** Phones already in the agent's CRM. */
  existingPhones?: string[];
  insertError?: unknown;
}

function makeDbMock(opts: DbMockOpts) {
  const { agent = null, existingPhones = [], insertError = null } = opts;
  const leadInserts: Record<string, unknown>[] = [];
  const reminderInserts: Record<string, unknown>[] = [];
  let leadSeq = 0;

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
          // Dedupe query: one SELECT for every phone the agent already has.
          select: () => ({
            eq: async () => ({
              data: existingPhones.map((p) => ({ contact_phone: p })),
              error: null,
            }),
          }),
          insert: (payload: Record<string, unknown>[]) => {
            const rows = Array.isArray(payload) ? payload : [payload];
            leadInserts.push(...rows);
            return {
              select: async () =>
                insertError
                  ? { data: null, error: insertError }
                  : {
                      data: rows.map((r) => ({
                        id: `lead-${++leadSeq}`,
                        renewal_date: r.renewal_date,
                      })),
                      error: null,
                    },
            };
          },
        };
      }
      if (table === "renewal_reminders") {
        return {
          insert: async (payload: Record<string, unknown>[]) => {
            reminderInserts.push(...(Array.isArray(payload) ? payload : [payload]));
            return { data: null, error: null };
          },
        };
      }
      return {};
    }),
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return { db, leadInserts, reminderInserts };
}

const ACTIVE_AGENT: Agent = { id: "a1", slug: "alice", is_active: true };

function row(over: Record<string, unknown> = {}) {
  return { name: "Maria Lopez", phone: "2395551234", ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
});

describe("POST /api/leads/import — auth", () => {
  it("returns 401 when no auth user is present", async () => {
    mockAuthUser(null);

    const res = await POST(makeRequest(row()));

    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/auth/i);
  });

  it("returns 403 when the auth user has no linked agent profile", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: null });

    const res = await POST(makeRequest(row()));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/no agent profile/i);
  });

  it("returns 403 when the linked agent is inactive", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: { id: "a1", slug: "alice", is_active: false } });

    const res = await POST(makeRequest(row()));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/inactive/i);
  });

  it("returns 429 when the rate limiter reports the user is limited", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: ACTIVE_AGENT });
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

    const res = await POST(makeRequest(row()));

    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("import:u1", {
      max: 10,
      windowMs: 60 * 60_000,
    });
    // The agent must be told what to do, not just handed a status code.
    expect((await res.json()).message).toMatch(/hora/i);
  });
});

describe("POST /api/leads/import — single client (legacy shape)", () => {
  it("creates a lead and derives agent_id/agent_slug from the session", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(
      makeRequest({
        name: "Maria Lopez",
        phone: "(239) 555-1234",
        email: "maria@example.com",
        planName: "Ambetter Gold",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, leadId: "lead-1" });
    expect(leadInserts).toHaveLength(1);
    expect(leadInserts[0].agent_id).toBe("a1");
    expect(leadInserts[0].agent_slug).toBe("alice");
    expect(leadInserts[0].contact_phone).toBe("2395551234");
  });

  it("ignores agent_slug from the body (anti-spoofing)", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(
      makeRequest(row({ agentSlug: "victim-agent", agent_slug: "victim-agent" }))
    );

    expect(res.status).toBe(200);
    expect(leadInserts[0].agent_slug).toBe("alice");
    expect(leadInserts[0].agent_id).toBe("a1");
  });

  it("reports a duplicate without inserting", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({
      agent: ACTIVE_AGENT,
      existingPhones: ["2395551234"],
    });

    const res = await POST(makeRequest(row()));

    expect(await res.json()).toEqual({ skipped: true, reason: "duplicate" });
    expect(leadInserts).toHaveLength(0);
  });

  it("returns 400 when name or phone is missing", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(makeRequest({ name: "Maria" }));

    expect(res.status).toBe(400);
  });
});

describe("POST /api/leads/import — batch", () => {
  it("imports a whole book in ONE request", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    const rows = Array.from({ length: 200 }, (_, i) => ({
      name: `Cliente ${i}`,
      phone: `239555${String(i).padStart(4, "0")}`,
    }));

    const res = await POST(makeRequest({ rows }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(200);
    expect(body.total).toBe(200);
    expect(leadInserts).toHaveLength(200);
    // One call to the limiter for the whole file, not one per client.
    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it("skips clients already in the agent's CRM without failing the file", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({
      agent: ACTIVE_AGENT,
      existingPhones: ["2395550001"],
    });

    const res = await POST(
      makeRequest({
        rows: [
          { name: "Ya existe", phone: "(239) 555-0001" },
          { name: "Nueva", phone: "2395550002" },
        ],
      })
    );

    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.skipped).toBe(1);
    expect(leadInserts).toHaveLength(1);
    expect(leadInserts[0].contact_name).toBe("Nueva");
  });

  it("dedupes against a phone stored with a country code", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({
      agent: ACTIVE_AGENT,
      existingPhones: ["12395550001"],
    });

    const res = await POST(makeRequest({ rows: [{ name: "Ana", phone: "239-555-0001" }] }));

    expect((await res.json()).skipped).toBe(1);
    expect(leadInserts).toHaveLength(0);
  });

  it("dedupes repeats inside the same file", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(
      makeRequest({
        rows: [
          { name: "Ana", phone: "2395550001" },
          { name: "Ana otra vez", phone: "(239) 555-0001" },
        ],
      })
    );

    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.skipped).toBe(1);
    expect(leadInserts).toHaveLength(1);
  });

  it("lets a bad row fail without blocking the rest of the file", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(
      makeRequest({
        rows: [
          { name: "Sin telefono", phone: "", line: 2 },
          { name: "", phone: "2395550002", line: 3 },
          { name: "Telefono corto", phone: "555", line: 4 },
          { name: "Buena", phone: "2395550005", line: 5 },
        ],
      })
    );

    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.errors).toBe(3);
    expect(leadInserts).toHaveLength(1);
    expect(body.details).toEqual([
      { line: 2, reason: "missing_phone" },
      { line: 3, reason: "missing_name" },
      { line: 4, reason: "invalid_phone" },
    ]);
  });

  it("never puts a client's data in the error details", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(
      makeRequest({
        rows: [{ name: "Maria Secreta", phone: "", email: "secreta@example.com", line: 7 }],
      })
    );

    const raw = JSON.stringify((await res.json()).details);
    expect(raw).not.toMatch(/Secreta/);
    expect(raw).not.toMatch(/example\.com/);
    expect(raw).toContain('"line":7');
  });

  it("writes a renewal date that the cron can still reach", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts, reminderInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(
      makeRequest({ rows: [{ name: "Ana", phone: "2395550001", effectiveDate: "2023-01-01" }] })
    );

    expect(res.status).toBe(200);
    const renewal = leadInserts[0].renewal_date as string;
    // The old rule produced 2024-01-01 here — already past, so
    // /api/cron/renewals (which matches renewal_date == today + 60/30/15)
    // could never fire for this client.
    expect(new Date(`${renewal}T00:00:00Z`).getTime()).toBeGreaterThan(Date.now());
    expect(renewal.endsWith("-01-01")).toBe(true);
    expect(reminderInserts).toHaveLength(1);
    expect(reminderInserts[0].renewal_date).toBe(renewal);
  });

  it("imports a client with no effective date and counts it as unreachable", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts, reminderInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(makeRequest({ rows: [{ name: "Ana", phone: "2395550001" }] }));

    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.missingEffectiveDate).toBe(1);
    expect(leadInserts[0].renewal_date).toBeNull();
    expect(reminderInserts).toHaveLength(0);
  });

  it("marks an active book client as enrolled", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    await POST(
      makeRequest({
        rows: [
          { name: "Ana", phone: "2395550001", status: "Active" },
          { name: "Luis", phone: "2395550002", status: "Terminated" },
        ],
      })
    );

    expect(leadInserts[0].status).toBe("enrolled");
    expect(leadInserts[0].enrolled_at).not.toBeNull();
    expect(leadInserts[1].status).toBe("new");
    expect(leadInserts[1].enrolled_at).toBeNull();
  });

  it("derives agent identity from the session for every row in the batch", async () => {
    mockAuthUser({ id: "u1" });
    const { leadInserts } = makeDbMock({ agent: ACTIVE_AGENT });

    await POST(
      makeRequest({
        agentSlug: "victim-agent",
        rows: [
          { name: "Ana", phone: "2395550001", agent_slug: "victim-agent", agent_id: "evil" },
          { name: "Luis", phone: "2395550002", agent_slug: "victim-agent", agent_id: "evil" },
        ],
      })
    );

    for (const lead of leadInserts) {
      expect(lead.agent_slug).toBe("alice");
      expect(lead.agent_id).toBe("a1");
    }
  });

  it("rejects a file above the per-request cap instead of truncating it", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: ACTIVE_AGENT });

    const rows = Array.from({ length: 1001 }, (_, i) => ({
      name: `C${i}`,
      phone: `23955${String(i).padStart(5, "0")}`,
    }));

    const res = await POST(makeRequest({ rows }));

    expect(res.status).toBe(413);
    expect((await res.json()).message).toMatch(/1001/);
  });

  it("returns 400 for an empty batch", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: ACTIVE_AGENT });

    const res = await POST(makeRequest({ rows: [] }));

    expect(res.status).toBe(400);
  });

  it("counts a failed insert as an error instead of reporting success", async () => {
    mockAuthUser({ id: "u1" });
    makeDbMock({ agent: ACTIVE_AGENT, insertError: { message: "boom" } });

    const res = await POST(makeRequest({ rows: [{ name: "Ana", phone: "2395550001" }] }));

    const body = await res.json();
    expect(body.imported).toBe(0);
    expect(body.errors).toBe(1);
  });
});
