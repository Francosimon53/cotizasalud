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

function makeRequest(body: unknown, ip = "203.0.113.4") {
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
  } as unknown as Parameters<typeof POST>[0];
}

function installSuccessDb() {
  const db = {
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ data: null, error: null })),
    })),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ai-log — rate limiting", () => {
  it("returns 429 after the rate limit is exceeded for a single IP", async () => {
    installSuccessDb();
    const MAX = 20;
    let count = 0;
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, opts: { max: number }) => {
        count++;
        return { limited: count > opts.max };
      }
    );

    for (let i = 0; i < MAX; i++) {
      const res = await POST(makeRequest({ question: "q", response: "r" }));
      expect(res.status).not.toBe(429);
    }

    const limited = await POST(makeRequest({ question: "q", response: "r" }));
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);
    expect(rateLimit).toHaveBeenCalledWith("ai-log:203.0.113.4", { max: 20, windowMs: 60_000 });
  });
});
