import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/auth/require-agent", () => ({
  requireAuthenticatedAgent: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));

import { POST } from "../import/route";
import { GET } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

function setAuthOk(agent = { id: "a1", slug: "alice", is_active: true }) {
  (requireAuthenticatedAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    agent,
    user: { id: "user-1" },
  });
}

function setAuthError(status: number, message: string) {
  (requireAuthenticatedAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    NextResponse.json({ error: message }, { status })
  );
}

function makeRequest(body: unknown): any {
  return { json: async () => body } as any;
}

function installDb(opts: { clientsInsertError?: unknown } = {}) {
  const importInserts: any[] = [];
  const clientInserts: any[] = [];
  const importDeletes: unknown[] = [];
  const eqCalls: Record<string, [string, unknown][]> = {
    portfolio_clients: [],
    portfolio_imports: [],
  };

  const db = {
    from: vi.fn((table: string) => {
      if (table === "portfolio_imports") {
        return {
          insert: (payload: any) => {
            importInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({ data: { id: "imp-1" }, error: null }),
              }),
            };
          },
          delete: () => ({
            eq: (_col: string, val: unknown) => {
              importDeletes.push(val);
              return Promise.resolve({ data: null, error: null });
            },
          }),
          select: () => ({
            eq: (col: string, val: unknown) => {
              eqCalls.portfolio_imports.push([col, val]);
              return {
                order: () => ({
                  limit: async () => ({
                    data: [{ id: "imp-1", file_name: "own.csv" }],
                    error: null,
                  }),
                }),
              };
            },
          }),
        };
      }
      if (table === "portfolio_clients") {
        return {
          insert: (payload: any) => {
            clientInserts.push(payload);
            return Promise.resolve({ error: opts.clientsInsertError ?? null });
          },
          select: () => ({
            eq: (col: string, val: unknown) => {
              eqCalls.portfolio_clients.push([col, val]);
              return {
                order: async () => ({
                  data: [{ id: "c1", full_name: "Propio Cliente", risk_score: 80 }],
                  error: null,
                }),
              };
            },
          }),
        };
      }
      return {};
    }),
    _importInserts: importInserts,
    _clientInserts: clientInserts,
    _importDeletes: importDeletes,
    _eqCalls: eqCalls,
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_FEATURE_CARTERA", "1");
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
});

describe("POST /api/cartera/import", () => {
  it("returns 404 when the feature flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CARTERA", "");
    const res = await POST(makeRequest({ rows: [{ full_name: "Ana" }] }));
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    setAuthError(401, "Authentication required");
    const res = await POST(makeRequest({ rows: [{ full_name: "Ana" }] }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    setAuthOk();
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ limited: true });
    const res = await POST(makeRequest({ rows: [{ full_name: "Ana" }] }));
    expect(res.status).toBe(429);
  });

  it("returns 400 on malformed body without echoing row contents", async () => {
    setAuthOk();
    installDb();
    const res = await POST(makeRequest({ rows: "not-an-array" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("not-an-array");
  });

  it("imports mixed valid/invalid rows and records counts in portfolio_imports", async () => {
    setAuthOk();
    const db = installDb();
    const res = await POST(
      makeRequest({
        fileName: "cartera.csv",
        rows: [
          // valid, full signals
          {
            full_name: "Cliente Uno",
            date_of_birth: "1965-03-10",
            household_members: "4",
            estimated_annual_income: "$150,000",
            metal_level: "Bronce",
            monthly_premium: "200",
            monthly_subsidy: "600",
            auto_renewal: "Sí",
          },
          // valid, minimal (name + premium only)
          { full_name: "Cliente Dos", monthly_premium: "450" },
          // invalid: unparseable premium
          { full_name: "Cliente Tres", monthly_premium: "mucho" },
          // invalid: missing name
          { monthly_premium: "300" },
        ],
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      importId: "imp-1",
      totalRows: 4,
      validRows: 2,
      errorRows: 2,
    });

    const importRow = db._importInserts[0];
    expect(importRow).toMatchObject({
      agent_id: "a1",
      file_name: "cartera.csv",
      total_rows: 4,
      valid_rows: 2,
      error_rows: 2,
    });
    // Error summary carries row numbers + field keys, never values (no PII).
    expect(importRow.errors).toEqual([
      { row: 3, reason: "invalid_monthly_premium" },
      { row: 4, reason: "invalid_full_name" },
    ]);

    const inserted = db._clientInserts[0];
    expect(inserted).toHaveLength(2);
    // High-risk client: full dependency (0.75→22) + cliff 25 + 55+ 15 +
    // bronze 10 + auto-renewal 15 + household 10 = 97 critical.
    expect(inserted[0]).toMatchObject({
      full_name: "Cliente Uno",
      metal_level: "bronze",
      auto_renewal: true,
      risk_level: "critical",
      import_id: "imp-1",
    });
    expect(inserted[0].risk_score).toBeGreaterThanOrEqual(90);
    expect(inserted[1]).toMatchObject({
      full_name: "Cliente Dos",
      risk_score: 0,
      risk_level: "low",
    });
  });

  it("anti-IDOR: inserted rows always use the session agent_id, ignoring body values", async () => {
    setAuthOk({ id: "a1", slug: "alice", is_active: true });
    const db = installDb();
    const res = await POST(
      makeRequest({
        agent_id: "victim-agent",
        rows: [{ full_name: "Ana García", monthly_premium: "300" }],
      })
    );
    expect(res.status).toBe(200);
    expect(db._importInserts[0].agent_id).toBe("a1");
    for (const client of db._clientInserts[0]) {
      expect(client.agent_id).toBe("a1");
    }
  });

  it("rolls back the import row and returns 500 when the clients insert fails", async () => {
    setAuthOk();
    const db = installDb({ clientsInsertError: { code: "23514", message: "boom" } });
    const res = await POST(makeRequest({ rows: [{ full_name: "Ana" }] }));
    expect(res.status).toBe(500);
    expect(db._importDeletes).toEqual(["imp-1"]);
  });

  it("rejects imports above the row limit", async () => {
    setAuthOk();
    installDb();
    const rows = Array.from({ length: 1001 }, (_, i) => ({ full_name: `C${i}` }));
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/cartera", () => {
  it("returns 404 when the feature flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CARTERA", "");
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    setAuthError(401, "Authentication required");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("anti-IDOR: only queries rows scoped to the session agent_id", async () => {
    setAuthOk({ id: "a1", slug: "alice", is_active: true });
    const db = installDb();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clients).toHaveLength(1);
    // Every read on both tables is filtered by the authenticated agent —
    // an agent can never read another agent's rows.
    expect(db._eqCalls.portfolio_clients).toEqual([["agent_id", "a1"]]);
    expect(db._eqCalls.portfolio_imports).toEqual([["agent_id", "a1"]]);
  });
});
