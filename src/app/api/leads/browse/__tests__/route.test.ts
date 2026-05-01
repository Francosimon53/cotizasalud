import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/resolve-agent", () => ({
  resolveAgentFromSlug: vi.fn(async () => ({ agent_id: "a1", agent_slug: "test" })),
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

import { POST } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown, ip = "203.0.113.2") {
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
    url: "http://localhost:3000/api/leads/browse",
  } as unknown as Parameters<typeof POST>[0];
}

function installSuccessDb() {
  const db = {
    from: vi.fn((table: string) => {
      if (table === "leads") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "lead-1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "page_views") {
        return { insert: vi.fn(async () => ({ data: null, error: null })) };
      }
      return {};
    }),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/leads/browse — rate limiting", () => {
  it("returns 429 after the rate limit is exceeded for a single IP", async () => {
    installSuccessDb();
    const MAX = 5;
    let count = 0;
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, opts: { max: number }) => {
        count++;
        return { limited: count > opts.max };
      }
    );

    for (let i = 0; i < MAX; i++) {
      const res = await POST(makeRequest({ zipcode: "33914" }));
      expect(res.status).not.toBe(429);
    }

    const limited = await POST(makeRequest({ zipcode: "33914" }));
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);
    expect(rateLimit).toHaveBeenCalledWith("leads-browse:203.0.113.2", { max: 5, windowMs: 60_000 });
  });
});
