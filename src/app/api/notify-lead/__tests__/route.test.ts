import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/normalize-slug", () => ({
  normalizeAgentSlug: vi.fn(() => ({ ok: true, slug: "test" })),
}));
vi.mock("@/lib/slug-logging", () => ({
  captureInvalidAgentSlug: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));
// Hoisted spy so tests can inspect the html/subject that was sent.
const { sendSpy } = vi.hoisted(() => ({
  sendSpy: vi.fn(async () => ({ data: { id: "msg-1" }, error: null })),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendSpy };
  },
}));

import { POST } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

function makeRequest(body: unknown, ip = "203.0.113.10"): any {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => {
        const n = name.toLowerCase();
        if (n === "x-forwarded-for") return ip;
        if (n === "user-agent") return "test-agent";
        if (n === "referer") return null;
        return null;
      },
    },
    url: "http://localhost:3000/api/notify-lead",
  };
}

function makeBadJsonRequest(ip = "203.0.113.10"): any {
  return {
    json: async () => {
      throw new Error("invalid json");
    },
    headers: {
      get: (name: string) => (name.toLowerCase() === "x-forwarded-for" ? ip : null),
    },
    url: "http://localhost:3000/api/notify-lead",
  };
}

function installDb(opts: {
  lead?: { id: string; created_at: string } | null;
  agent?: { email: string; name: string } | null;
}) {
  const { lead = null, agent = null } = opts;
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
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: agent, error: agent ? null : null }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
});

describe("POST /api/notify-lead", () => {
  it("returns 429 when rate limited", async () => {
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });

    const res = await POST(makeRequest({ leadId: VALID_UUID }));

    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("notify-lead:203.0.113.10", { max: 5, windowMs: 60_000 });
  });

  it("returns 400 when the body is missing leadId", async () => {
    const res = await POST(makeRequest({ contactName: "Maria" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing leadid/i);
  });

  it("returns 400 when leadId is not a valid UUID", async () => {
    const res = await POST(makeRequest({ leadId: "not-a-uuid" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid leadid format/i);
  });

  it("returns 400 (vague) when the lead does not exist", async () => {
    installDb({ lead: null });

    const res = await POST(makeRequest({ leadId: VALID_UUID }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid lead reference/i);
  });

  it("returns 400 (vague) when the lead is older than the recency window (anti-spoofing)", async () => {
    const staleCreatedAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    installDb({ lead: { id: VALID_UUID, created_at: staleCreatedAt } });

    const res = await POST(makeRequest({ leadId: VALID_UUID }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid lead reference/i);
  });

  it("sends the notification when the lead exists and is recent", async () => {
    const recentCreatedAt = new Date(Date.now() - 30_000).toISOString();
    installDb({
      lead: { id: VALID_UUID, created_at: recentCreatedAt },
      agent: { email: "agent@example.com", name: "Alice" },
    });

    const res = await POST(
      makeRequest({
        leadId: VALID_UUID,
        agentSlug: "alice",
        contactName: "Maria",
        contactPhone: "2395551234",
        contactEmail: "maria@example.com",
        zipcode: "33914",
        county: "Lee",
        state: "FL",
        householdSize: 2,
        annualIncome: 28000,
        fplPercentage: 130,
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(true);
  });
});

describe("POST /api/notify-lead — body parsing", () => {
  it("returns 400 when the request body is not valid JSON", async () => {
    const res = await POST(makeBadJsonRequest());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid request body/i);
  });
});

describe("POST /api/notify-lead — HTML escaping (PR F)", () => {
  it("escapes XSS payloads in user-controlled fields before sending", async () => {
    const recentCreatedAt = new Date(Date.now() - 30_000).toISOString();
    installDb({
      lead: { id: VALID_UUID, created_at: recentCreatedAt },
      agent: { email: "agent@example.com", name: "Alice" },
    });
    sendSpy.mockClear();

    const xss = `<script>alert('pwn')</script>`;
    const res = await POST(
      makeRequest({
        leadId: VALID_UUID,
        agentSlug: "alice",
        contactName: xss,
        contactPhone: "239<555>1234",
        contactEmail: "<a href='evil'>m@x</a>",
        zipcode: "33914",
        county: "Lee",
        state: "FL",
        householdSize: 1,
        annualIncome: 28000,
        fplPercentage: 130,
        conversationSummary: `</td><td>injected</td><td>`,
      })
    );

    expect(res.status).toBe(200);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sent = (sendSpy.mock.calls[0] as unknown as Array<{ html: string; subject: string }>)[0];

    // Body must contain the escaped versions, never the raw tags.
    expect(sent.html).toContain("&lt;script&gt;alert(&#39;pwn&#39;)&lt;/script&gt;");
    expect(sent.html).not.toContain("<script>alert");
    expect(sent.html).toContain("239&lt;555&gt;1234");
    expect(sent.html).toContain("&lt;a href=&#39;evil&#39;&gt;m@x&lt;/a&gt;");
    expect(sent.html).toContain("&lt;/td&gt;&lt;td&gt;injected");
    expect(sent.html).not.toContain("</td><td>injected");
  });

  it("strips control chars from the subject line so headers can't be injected", async () => {
    const recentCreatedAt = new Date(Date.now() - 30_000).toISOString();
    installDb({
      lead: { id: VALID_UUID, created_at: recentCreatedAt },
      agent: { email: "agent@example.com", name: "Alice" },
    });
    sendSpy.mockClear();

    await POST(
      makeRequest({
        leadId: VALID_UUID,
        agentSlug: "alice",
        contactName: "Maria\r\nBcc: attacker@evil.com",
        contactPhone: "1234567890",
        zipcode: "33914",
        county: "Lee",
        state: "FL",
        householdSize: 1,
        annualIncome: 28000,
        fplPercentage: 130,
      })
    );

    const sent = (sendSpy.mock.calls[0] as unknown as Array<{ html: string; subject: string }>)[0];
    expect(sent.subject).not.toContain("\r");
    expect(sent.subject).not.toContain("\n");
    expect(sent.subject).toContain("MariaBcc: attacker@evil.com");
  });
});
