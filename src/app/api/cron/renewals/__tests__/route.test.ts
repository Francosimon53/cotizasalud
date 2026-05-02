import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));

// Hoisted spy so the WhatsApp-sanitization test can inspect what Twilio was
// asked to send.
const { twilioCreateSpy } = vi.hoisted(() => ({
  twilioCreateSpy: vi.fn(async () => ({ sid: "SMxxxxxxx" })),
}));
vi.mock("twilio", () => ({
  default: () => ({
    messages: { create: twilioCreateSpy },
  }),
}));

import { GET } from "../route";
import { createServiceClient } from "@/lib/supabase";

function makeRequest(authHeader?: string): any {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "authorization") return authHeader ?? null;
        return null;
      },
    },
    nextUrl: { origin: "http://localhost:3000" },
  };
}

// Default supabase chains: every renewal-reminder query returns an empty array,
// so the handler short-circuits each loop and reaches the final response with
// zero counters. Sufficient for verifying the auth gate passed and the cron
// body executed.
function installEmptyDb() {
  const db = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    })),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

const originalCronSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

// More elaborate db mock for the WhatsApp test below: returns one 60-day
// renewal reminder and lets the rem30/rem15 queries fall through with []. Per
// table:
//   renewal_reminders: select+eq+eq → queues from renewalQueues; update → noop
//   leads: select+eq+single → lead
//   agents: select+eq+single → agent
//   lead_activity: insert → noop
function installFullDb(opts: {
  rem60?: Array<{ id: string; lead_id: string; renewal_date: string }>;
  lead?: Record<string, unknown> | null;
  agent?: Record<string, unknown> | null;
}) {
  const { rem60 = [], lead = null, agent = null } = opts;
  let renewalCallIndex = 0;
  const renewalQueues = [rem60, [], []]; // 60 → 30 → 15

  const db = {
    from: vi.fn((table: string) => {
      if (table === "renewal_reminders") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => {
                const data = renewalQueues[renewalCallIndex] ?? [];
                renewalCallIndex++;
                return { data, error: null };
              },
            }),
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        };
      }
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
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: agent,
                error: agent ? null : { code: "PGRST116" },
              }),
            }),
          }),
        };
      }
      if (table === "lead_activity") {
        return {
          insert: vi.fn(async () => ({ data: null, error: null })),
        };
      }
      return {};
    }),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

describe("GET /api/cron/renewals — auth gate", () => {
  it("returns 500 when CRON_SECRET is not configured (fail closed)", async () => {
    delete process.env.CRON_SECRET;
    installEmptyDb();

    const res = await GET(makeRequest("Bearer anything"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/misconfigured/i);
    // The body of the cron must NOT have run.
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    process.env.CRON_SECRET = "test-secret";
    installEmptyDb();

    const res = await GET(makeRequest(undefined));

    expect(res.status).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header carries a wrong secret", async () => {
    process.env.CRON_SECRET = "test-secret";
    installEmptyDb();

    const res = await GET(makeRequest("Bearer not-the-secret"));

    expect(res.status).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 200 and runs the cron when the secret matches", async () => {
    process.env.CRON_SECRET = "test-secret";
    const db = installEmptyDb();

    const res = await GET(makeRequest("Bearer test-secret"));

    expect(res.status).toBe(200);
    expect(db.from).toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.reminders_60).toBe(0);
    expect(body.reminders_30).toBe(0);
    expect(body.reminders_15).toBe(0);
  });
});

describe("GET /api/cron/renewals — WhatsApp sanitization (PR F)", () => {
  const originalTwilio = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_WHATSAPP_NUMBER,
  };

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.TWILIO_WHATSAPP_NUMBER = "+15551234567";
    twilioCreateSpy.mockClear();
  });

  afterEach(() => {
    if (originalTwilio.sid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = originalTwilio.sid;
    if (originalTwilio.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalTwilio.token;
    if (originalTwilio.from === undefined) delete process.env.TWILIO_WHATSAPP_NUMBER;
    else process.env.TWILIO_WHATSAPP_NUMBER = originalTwilio.from;
  });

  it("strips control chars from a malicious lead.contact_name and caps length", async () => {
    // 150-char malicious name interleaved with CR/LF + a fake URL injection.
    const longName =
      "Maria\r\nhttps://evil.com/x" + "A".repeat(150);
    installFullDb({
      rem60: [
        { id: "rr-1", lead_id: "lead-1", renewal_date: "2026-07-01" },
      ],
      lead: {
        contact_name: longName,
        contact_phone: "(239) 555-1234",
        agent_slug: "alice",
        selected_plan_name: "Ambetter Gold\r\nFINE PRINT",
      },
      agent: { name: "Alice\r\nFAKE", phone: "5551234567" },
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(twilioCreateSpy).toHaveBeenCalledTimes(1);

    const sentBody = (
      twilioCreateSpy.mock.calls[0] as unknown as Array<{ body: string }>
    )[0].body;

    // CR/LF removed.
    expect(sentBody).not.toContain("\r");
    expect(sentBody).not.toContain("\n");
    // Length cap on contact_name (100 chars) means the full 150 As do not appear.
    expect(sentBody).not.toContain("A".repeat(150));
    // Agent name CRLF was stripped (so the literal substring "Alice\r\nFAKE"
    // collapses to "AliceFAKE", but more importantly, no header injection).
    expect(sentBody).toContain("AliceFAKE");
    // Plan name CRLF stripped.
    expect(sentBody).toContain("Ambetter GoldFINE PRINT");
  });
});
