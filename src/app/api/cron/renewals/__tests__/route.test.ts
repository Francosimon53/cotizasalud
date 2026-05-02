import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
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
