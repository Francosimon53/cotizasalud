import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// End-to-end over the real path an agent takes: a HealthSherpa-shaped export
// goes through the real parser and the real route handler, with only the
// database mocked. This is the case the importer used to fail on.

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase-auth", () => ({ createServerAuthClient: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ limited: false })) }));

import { POST } from "../route";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { parseLeadFile } from "@/lib/leads/import-csv";

const FIXTURE = path.join(
  process.cwd(),
  "src/lib/leads/__tests__/fixtures/libro-ejemplo.csv"
);

/** The parser that shipped in ImportClient.tsx before this change. */
function legacyParser(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const get = (keys: string[]) => {
      for (const k of keys) {
        const i = headers.indexOf(k);
        if (i >= 0 && vals[i]) return vals[i];
      }
      return "";
    };
    return {
      name: `${get(["first name"])} ${get(["last name"])}`.trim(),
      premium: get(["monthly premium"]),
      phone: get(["phone"]),
    };
  }).filter((r) => r.name);
}

let leadInserts: Record<string, unknown>[] = [];
let reminderInserts: Record<string, unknown>[] = [];

beforeEach(() => {
  leadInserts = [];
  reminderInserts = [];
  (createServerAuthClient as never as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  });
  let seq = 0;
  (createServiceClient as never as ReturnType<typeof vi.fn>).mockReturnValue({
    from: (table: string) => {
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "a1", slug: "alice", is_active: true },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({ eq: async () => ({ data: [], error: null }) }),
          insert: (rows: Record<string, unknown>[]) => {
            leadInserts.push(...rows);
            return {
              select: async () => ({
                data: rows.map((r) => ({ id: `lead-${++seq}`, renewal_date: r.renewal_date })),
                error: null,
              }),
            };
          },
        };
      }
      if (table === "renewal_reminders") {
        return {
          insert: async (rows: Record<string, unknown>[]) => {
            reminderInserts.push(...rows);
            return { data: null, error: null };
          },
        };
      }
      return {};
    },
  });
});

describe("importar un libro completo tipo HealthSherpa", () => {
  const text = readFileSync(FIXTURE, "utf8");

  it("the legacy comma-splitting parser corrupted rows this file contains", () => {
    const legacy = legacyParser(text);
    // Every row whose plan name or note carries a quoted comma shifted its
    // later columns by one, so the premium column read as something else.
    const brokenPremiums = legacy.filter(
      (r) => r.premium === "" || !/^\$?[\d,]+(\.\d+)?$/.test(r.premium)
    );
    expect(brokenPremiums.length).toBeGreaterThan(0);
  });

  it("the current parser reads the same file without shifting a column", () => {
    const parsed = parseLeadFile(text);
    const maria = parsed.rows.find((r) => r.name.startsWith("Maria"));
    expect(maria?.name).toBe("Maria Lopez, Jose");
    expect(maria?.premium).toBe("$116.24");
    expect(maria?.phone).toBe("(239) 555-0001");

    const luis = parsed.rows.find((r) => r.name.startsWith("Luis"));
    expect(luis?.name).toBe('Luis O"Brien');

    expect(parsed.ignoredHeaders).toEqual(["Agent Notes"]);
    expect(parsed.missingFields).toEqual([]);
    expect(parsed.droppedRows).toBe(1); // la fila de solo comas
  });

  it("sube el libro entero en una sola petición y explica cada fila que no entró", async () => {
    const parsed = parseLeadFile(text);
    const res = await POST({ json: async () => ({ rows: parsed.rows }) } as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(6);
    expect(body.skipped).toBe(1); // teléfono repetido dentro del archivo
    expect(body.errors).toBe(3); // sin teléfono, sin nombre, teléfono corto
    expect(body.missingEffectiveDate).toBe(1);
    expect(body.imported + body.skipped + body.errors).toBe(body.total);

    const reasons = body.details.map((d: { reason: string }) => d.reason).sort();
    expect(reasons).toEqual(["duplicate_in_file", "invalid_phone", "missing_name", "missing_phone"]);
  });

  it("no deja ninguna renovación en el pasado, que el cron nunca alcanzaría", async () => {
    const parsed = parseLeadFile(text);
    await POST({ json: async () => ({ rows: parsed.rows }) } as never);

    const withRenewal = leadInserts.filter((l) => l.renewal_date);
    expect(withRenewal.length).toBeGreaterThan(0);
    for (const lead of withRenewal) {
      expect(
        new Date(`${lead.renewal_date as string}T00:00:00Z`).getTime()
      ).toBeGreaterThan(Date.now());
    }
    // El cliente de 2020 es el caso que la regla vieja mandaba a 2021.
    const antiguo = leadInserts.find((l) => l.enrollment_date === "2020-01-01");
    expect(antiguo?.renewal_date).toBe("2027-01-01");
    expect(reminderInserts).toHaveLength(withRenewal.length);
  });

  it("normaliza el teléfono con código de país para que el dedupe funcione", async () => {
    const parsed = parseLeadFile(text);
    await POST({ json: async () => ({ rows: parsed.rows }) } as never);
    const ana = leadInserts.find((l) => l.contact_name === "Ana Martinez de la Cruz");
    expect(ana?.contact_phone).toBe("2395550003");
  });
});
