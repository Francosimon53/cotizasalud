import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));

import { POST } from "../route";
import { rateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown = { messages: [{ role: "user", content: "hi" }] }, ip = "203.0.113.52"): any {
  return {
    json: async () => body,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-forwarded-for" ? ip : null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "ok" }] }),
      text: async () => "",
    }))
  );
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("POST /api/ai-explain — rate limiting", () => {
  it("returns 429 after the rate limit is exceeded for a single IP", async () => {
    const MAX = 5;
    let count = 0;
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, opts: { max: number }) => {
        count++;
        return { limited: count > opts.max };
      }
    );

    for (let i = 0; i < MAX; i++) {
      const res = await POST(makeRequest());
      expect(res.status).not.toBe(429);
    }

    const limited = await POST(makeRequest());
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);
    expect(rateLimit).toHaveBeenCalledWith("ai-explain:203.0.113.52", {
      max: 5,
      windowMs: 60_000,
    });
  });
});
