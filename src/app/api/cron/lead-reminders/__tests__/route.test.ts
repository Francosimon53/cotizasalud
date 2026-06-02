import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));

const { day3Spy, day7Spy } = vi.hoisted(() => ({
  day3Spy: vi.fn<(input: any) => Promise<{ sent: boolean; reason?: string }>>(async () => ({ sent: true })),
  day7Spy: vi.fn<(input: any) => Promise<{ sent: boolean; reason?: string }>>(async () => ({ sent: true })),
}));
vi.mock("@/lib/email", () => ({
  sendDay3ReminderEmail: day3Spy,
  sendDay7ReminderEmail: day7Spy,
}));

import { GET, POST } from "../route";
import { createServiceClient } from "@/lib/supabase";

function makeRequest(authHeader?: string): any {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? authHeader ?? null : null,
    },
    nextUrl: { origin: "http://localhost:3000" },
  };
}

/**
 * Chainable Supabase mock. Every builder method returns the same thenable
 * builder; the resolved value is decided lazily from the accumulated table +
 * filters, so a single object serves the day-7 select, the day-3 select, the
 * update().eq() guard write, the agents single() lookup, and the
 * lead_activity insert.
 */
function installDb(opts: {
  day7?: any[];
  day3?: any[];
  agent?: { email: string; name: string } | null;
}) {
  const { day7 = [], day3 = [], agent = null } = opts;
  const updateCalls: Array<Record<string, unknown>> = [];
  const activityInserts: Array<Record<string, unknown>> = [];

  function builder(table: string) {
    const state: { isCol?: string; isUpdate?: boolean } = {};
    const resolve = () => {
      if (table === "agents") {
        return { data: agent, error: agent ? null : { code: "PGRST116" } };
      }
      if (table === "leads" && state.isUpdate) return { data: null, error: null };
      if (table === "leads" && state.isCol === "reminder_7_sent_at") {
        return { data: day7, error: null };
      }
      if (table === "leads" && state.isCol === "reminder_3_sent_at") {
        return { data: day3, error: null };
      }
      return { data: null, error: null };
    };
    const api: any = {
      select: () => api,
      lte: () => api,
      gt: () => api,
      in: () => api,
      is: (col: string) => {
        state.isCol = col;
        return api;
      },
      update: (payload: Record<string, unknown>) => {
        state.isUpdate = true;
        updateCalls.push(payload);
        return api;
      },
      eq: () => api,
      single: async () => resolve(),
      insert: async (payload: Record<string, unknown>) => {
        if (table === "lead_activity") activityInserts.push(payload);
        return { data: null, error: null };
      },
      then: (onF: (v: any) => unknown, onR?: (e: any) => unknown) =>
        Promise.resolve(resolve()).then(onF, onR),
    };
    return api;
  }

  const db = { from: vi.fn((table: string) => builder(table)) };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return { db, updateCalls, activityInserts };
}

const originalCronSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  day3Spy.mockResolvedValue({ sent: true });
  day7Spy.mockResolvedValue({ sent: true });
});

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe("cron/lead-reminders — auth gate", () => {
  it("returns 500 when CRON_SECRET is not configured (fail closed)", async () => {
    delete process.env.CRON_SECRET;
    installDb({});
    const res = await GET(makeRequest("Bearer anything"));
    expect(res.status).toBe(500);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    process.env.CRON_SECRET = "test-secret";
    installDb({});
    const res = await GET(makeRequest(undefined));
    expect(res.status).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret is wrong", async () => {
    process.env.CRON_SECRET = "test-secret";
    installDb({});
    const res = await GET(makeRequest("Bearer nope"));
    expect(res.status).toBe(401);
  });

  it("POST is accepted with the correct secret", async () => {
    process.env.CRON_SECRET = "test-secret";
    installDb({});
    const res = await POST(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
  });
});

describe("cron/lead-reminders — dispatch", () => {
  it("emails the assigned agent (not the lead) and stamps the guard column", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { updateCalls, activityInserts } = installDb({
      day7: [
        { id: "lead-7", contact_name: "Ana Díaz", contact_phone: "(239) 555-0001", agent_slug: "alice", created_at: "2026-05-20T12:00:00Z" },
      ],
      day3: [
        { id: "lead-3", contact_name: "Beto Ruiz", contact_phone: null, agent_slug: "alice", created_at: "2026-05-27T12:00:00Z" },
      ],
      agent: { email: "alice@agency.com", name: "Alice" },
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, reminders_3: 1, reminders_7: 1, errors: 0 });

    // Each email went to the agent's address, never to a lead.
    expect(day7Spy).toHaveBeenCalledTimes(1);
    expect(day3Spy).toHaveBeenCalledTimes(1);
    expect(day7Spy.mock.calls[0][0]).toMatchObject({ to: "alice@agency.com", leadName: "Ana Díaz" });
    expect(day3Spy.mock.calls[0][0]).toMatchObject({ to: "alice@agency.com", leadName: "Beto Ruiz" });

    // Both guard columns were stamped, and activity logged.
    expect(updateCalls.some((u) => "reminder_7_sent_at" in u)).toBe(true);
    expect(updateCalls.some((u) => "reminder_3_sent_at" in u)).toBe(true);
    expect(activityInserts).toHaveLength(2);
  });

  it("does not stamp the guard column when the email fails to send", async () => {
    process.env.CRON_SECRET = "test-secret";
    day7Spy.mockResolvedValue({ sent: false, reason: "boom" });
    const { updateCalls } = installDb({
      day7: [
        { id: "lead-7", contact_name: "Ana", contact_phone: null, agent_slug: "alice", created_at: "2026-05-20T12:00:00Z" },
      ],
      agent: { email: "alice@agency.com", name: "Alice" },
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    const body = await res.json();
    expect(body).toMatchObject({ reminders_7: 0, errors: 1 });
    expect(updateCalls.some((u) => "reminder_7_sent_at" in u)).toBe(false);
  });

  it("falls back to the platform email when the lead has no active agent", async () => {
    process.env.CRON_SECRET = "test-secret";
    installDb({
      day3: [
        { id: "lead-3", contact_name: "Sin Agente", contact_phone: null, agent_slug: null, created_at: "2026-05-27T12:00:00Z" },
      ],
      agent: null,
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(day3Spy.mock.calls[0][0]).toMatchObject({ to: "leads@enrollsalud.com" });
  });
});
