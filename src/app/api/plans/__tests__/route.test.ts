import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));
vi.mock("@/lib/data", () => ({
  getFPLpct: vi.fn(() => 130),
}));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));

import { POST } from "../route";
import { rateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown, ip = "203.0.113.41"): any {
  return {
    json: async () => body,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-forwarded-for" ? ip : null,
    },
  };
}

const validBody = {
  zipcode: "33914",
  countyfips: "12071",
  state: "FL",
  income: 28000,
  household: [{ age: 35, gender: "Female", tobacco: false }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ plans: [], total: 0 }),
      text: async () => "",
      status: 200,
    }))
  );
  process.env.CMS_API_KEY = "test-key";
});

describe("POST /api/plans — rate limiting", () => {
  it("returns 429 after the rate limit is exceeded for a single IP", async () => {
    const MAX = 10;
    let count = 0;
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, opts: { max: number }) => {
        count++;
        return { limited: count > opts.max };
      }
    );

    for (let i = 0; i < MAX; i++) {
      const res = await POST(makeRequest(validBody));
      expect(res.status).not.toBe(429);
    }

    const limited = await POST(makeRequest(validBody));
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);
    expect(rateLimit).toHaveBeenCalledWith("plans:203.0.113.41", {
      max: 10,
      windowMs: 60_000,
    });
  });
});
