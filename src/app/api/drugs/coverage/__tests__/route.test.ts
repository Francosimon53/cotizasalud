import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));

import { GET } from "../route";
import { rateLimit } from "@/lib/rate-limit";

function makeRequest(ip = "203.0.113.42"): any {
  const url = new URL(
    "http://localhost:3000/api/drugs/coverage?drugs=12345&planids=plan1,plan2&year=2026"
  );
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-forwarded-for" ? ip : null,
    },
    nextUrl: url,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ coverage: [] }),
      text: async () => "",
      status: 200,
    }))
  );
  process.env.CMS_API_KEY = "test-key";
});

describe("GET /api/drugs/coverage — rate limiting", () => {
  it("returns 429 after the rate limit is exceeded for a single IP", async () => {
    const MAX = 50;
    let count = 0;
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, opts: { max: number }) => {
        count++;
        return { limited: count > opts.max };
      }
    );

    for (let i = 0; i < MAX; i++) {
      const res = await GET(makeRequest());
      expect(res.status).not.toBe(429);
    }

    const limited = await GET(makeRequest());
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);
    expect(rateLimit).toHaveBeenCalledWith("drugs-coverage:203.0.113.42", {
      max: 50,
      windowMs: 60_000,
    });
  });
});
