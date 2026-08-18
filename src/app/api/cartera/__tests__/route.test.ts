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

// In-memory portfolio_clients honoring the (agent_id, dedupe_key) unique
// index, so double-import behavior is exercised end-to-end against the same
// upsert semantics the real table enforces.
function installDb(opts: { clientsUpsertError?: unknown } = {}) {
  const importInserts: any[] = [];
  const clientStore: any[] = [];
  const upsertBatches: { payload: any[]; onConflict?: string }[] = [];
  const importDeletes: unknown[] = [];
  const eqCalls: Record<string, [string, unknown][]> = {
    portfolio_clients: [],
    portfolio_imports: [],
  };
  let importSeq = 0;

  const db = {
    from: vi.fn((table: string) => {
      if (table === "portfolio_imports") {
        return {
          insert: (payload: any) => {
            importInserts.push(payload);
            importSeq++;
            return {
              select: () => ({
                single: async () => ({ data: { id: `imp-${importSeq}` }, error: null }),
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
          upsert: (payload: any[], o?: { onConflict?: string }) => {
            upsertBatches.push({ payload, onConflict: o?.onConflict });
            if (opts.clientsUpsertError) {
              return Promise.resolve({ error: opts.clientsUpsertError });
            }
            for (const row of payload) {
              const idx = clientStore.findIndex(
                (r) => r.agent_id === row.agent_id && r.dedupe_key === row.dedupe_key
              );
              if (idx >= 0) clientStore[idx] = { ...clientStore[idx], ...row };
              else clientStore.push({ id: `c${clientStore.length + 1}`, ...row });
            }
            return Promise.resolve({ error: null });
          },
          select: (_cols?: string) => ({
            eq: (col: string, val: unknown) => {
              eqCalls.portfolio_clients.push([col, val]);
              // Awaited directly by the import route (existing dedupe keys);
              // .order() chained by the GET route.
              const keys = clientStore
                .filter((r) => r.agent_id === val)
                .map((r) => ({ dedupe_key: r.dedupe_key }));
              const thenable = Promise.resolve({ data: keys, error: null });
              return Object.assign(thenable, {
                order: async () => ({
                  data: [{ id: "c1", full_name: "Propio Cliente", risk_score: 80 }],
                  error: null,
                }),
              });
            },
          }),
        };
      }
      return {};
    }),
    _importInserts: importInserts,
    _clientStore: clientStore,
    _upsertBatches: upsertBatches,
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
      insertedRows: 2,
      updatedRows: 0,
      possibleDuplicates: 0,
    });

    const importRow = db._importInserts[0];
    expect(importRow).toMatchObject({
      agent_id: "a1",
      file_name: "cartera.csv",
      total_rows: 4,
      valid_rows: 2,
      error_rows: 2,
      inserted_rows: 2,
      updated_rows: 0,
      possible_duplicates: 0,
    });
    // Error summary carries row numbers + field keys, never values (no PII).
    expect(importRow.errors).toEqual([
      { row: 3, reason: "invalid_monthly_premium" },
      { row: 4, reason: "invalid_full_name" },
    ]);

    expect(db._upsertBatches[0].onConflict).toBe("agent_id,dedupe_key");
    const store = db._clientStore;
    expect(store).toHaveLength(2);
    // High-risk client: dependency (0.75→23) + cliff 25 + age 60+ 15 +
    // bronze 8 + auto-renewal 15 + household 3-4 4 = 90 critical.
    expect(store[0]).toMatchObject({
      full_name: "Cliente Uno",
      metal_level: "bronze",
      auto_renewal: true,
      risk_level: "critical",
      import_id: "imp-1",
      dedupe_key: "cliente uno|d:1965-03-10",
    });
    expect(store[0].risk_score).toBeGreaterThanOrEqual(90);
    expect(store[1]).toMatchObject({
      full_name: "Cliente Dos",
      risk_score: 0,
      risk_level: "low",
      dedupe_key: "cliente dos|n:",
    });
  });

  it("re-importing the same rows updates in place instead of duplicating", async () => {
    setAuthOk();
    const db = installDb();
    const rows = [
      {
        full_name: "Cliente Uno",
        date_of_birth: "1965-03-10",
        monthly_premium: "200",
        monthly_subsidy: "600",
      },
      { full_name: "Cliente Cuatro", zip_code: "33125", monthly_premium: "450" },
    ];

    const first = await POST(makeRequest({ rows }));
    expect(await first.json()).toMatchObject({ insertedRows: 2, updatedRows: 0 });

    // Second import: new premium for Cliente Uno must overwrite, not append.
    const res = await POST(
      makeRequest({
        rows: [{ ...rows[0], monthly_premium: "900", monthly_subsidy: "0" }, rows[1]],
      })
    );
    const body = await res.json();
    expect(body).toMatchObject({
      insertedRows: 0,
      updatedRows: 2,
      possibleDuplicates: 0,
    });
    expect(db._clientStore).toHaveLength(2);
    const uno = db._clientStore.find((c: any) => c.full_name === "Cliente Uno");
    expect(uno.monthly_premium).toBe(900);
    // Score was recalculated with the new data (dependency ratio dropped to 0).
    expect(uno.risk_score).toBeLessThan(90);
    expect(uno.import_id).toBe("imp-2");
  });

  it("never merges name-only collisions: counts them as possible duplicates", async () => {
    setAuthOk();
    const db = installDb();
    // Two bare homonyms in the same file: only the first is written.
    const first = await POST(
      makeRequest({
        rows: [
          { full_name: "Juan Pérez", monthly_premium: "300" },
          { full_name: "Juan Pérez", monthly_premium: "500" },
        ],
      })
    );
    const firstBody = await first.json();
    expect(firstBody).toMatchObject({
      validRows: 2,
      insertedRows: 1,
      updatedRows: 0,
      possibleDuplicates: 1,
    });
    expect(db._clientStore).toHaveLength(1);
    expect(db._clientStore[0].monthly_premium).toBe(300);

    // Re-import of a bare name that already exists in the book: the stored
    // row is left untouched (a homonym could be a different person).
    const second = await POST(
      makeRequest({ rows: [{ full_name: "Juan Pérez", monthly_premium: "800" }] })
    );
    expect(await second.json()).toMatchObject({
      insertedRows: 0,
      updatedRows: 0,
      possibleDuplicates: 1,
    });
    expect(db._clientStore).toHaveLength(1);
    expect(db._clientStore[0].monthly_premium).toBe(300);
    expect(db._importInserts[1]).toMatchObject({ possible_duplicates: 1 });
  });

  it("integration: importing the synthetic 100-client CSV twice leaves 100 rows, not 200", async () => {
    setAuthOk();
    const db = installDb();
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const { parseCsv, suggestMapping, applyMapping } = await import("@/lib/cartera/csv");
    const text = readFileSync(join(process.cwd(), "scripts", "cartera-sintetica.csv"), "utf-8");
    const { headers, rows } = parseCsv(text);
    const mapping = suggestMapping(headers);
    const payload = rows.map((r) => applyMapping(mapping, r));

    const first = await POST(makeRequest({ fileName: "cartera-sintetica.csv", rows: payload }));
    expect(await first.json()).toMatchObject({
      validRows: 100,
      insertedRows: 100,
      updatedRows: 0,
      possibleDuplicates: 0,
    });
    expect(db._clientStore).toHaveLength(100);

    const second = await POST(makeRequest({ fileName: "cartera-sintetica.csv", rows: payload }));
    expect(await second.json()).toMatchObject({
      validRows: 100,
      insertedRows: 0,
      updatedRows: 100,
      possibleDuplicates: 0,
    });
    expect(db._clientStore).toHaveLength(100);
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
    for (const client of db._clientStore) {
      expect(client.agent_id).toBe("a1");
    }
  });

  it("rolls back the import row and returns 500 when the clients upsert fails", async () => {
    setAuthOk();
    const db = installDb({ clientsUpsertError: { code: "23514", message: "boom" } });
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
