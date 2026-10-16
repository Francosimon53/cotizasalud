import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));

// Hoisted spy: EnrollSalud never messages end consumers (Terms of Service),
// so the cron must never call Twilio even when TWILIO_* is configured.
const { twilioCreateSpy } = vi.hoisted(() => ({
  twilioCreateSpy: vi.fn(async () => ({ sid: "SMxxxxxxx" })),
}));
vi.mock("twilio", () => ({
  default: () => ({
    messages: { create: twilioCreateSpy },
  }),
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

// ---------------------------------------------------------------------------
// Renovaciones del 1 de enero: anclas al 15 de diciembre, con reloj fijo.
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  lead_id: string;
  renewal_date: string;
  reminder_60_sent: boolean;
  reminder_30_sent: boolean;
  reminder_15_sent: boolean;
};

function row(over: Partial<Row> = {}): Row {
  return {
    id: "rr-1",
    lead_id: "lead-1",
    renewal_date: "2027-01-01",
    reminder_60_sent: false,
    reminder_30_sent: false,
    reminder_15_sent: false,
    ...over,
  };
}

// renewal_reminders: cada .eq() encadena un filtro y la consulta se resuelve
// al hacer await, así sirve tanto para .eq().eq() (lógica 60/30/15 original)
// como para .eq() (renovaciones del 1 de enero).
function installEneroDb(rows: Row[]) {
  const updates: Array<{ id: unknown; payload: Record<string, unknown> }> = [];
  const notes: string[] = [];
  const query = (filters: Array<[string, unknown]>): any => ({
    eq: (col: string, val: unknown) => query([...filters, [col, val]]),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({
        data: rows.filter((r) => filters.every(([c, v]) => (r as any)[c] === v)),
        error: null,
      }).then(resolve, reject),
  });
  const db = {
    from: vi.fn((table: string) => {
      if (table === "renewal_reminders") {
        return {
          select: () => query([]),
          update: (payload: Record<string, unknown>) => ({
            eq: async (_col: string, id: unknown) => {
              updates.push({ id, payload });
              return { data: null, error: null };
            },
          }),
        };
      }
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { contact_name: "Ana Prueba", contact_phone: "2395550000", agent_slug: "alice" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { name: "Alice Agente", phone: "2395551111" }, error: null }),
            }),
          }),
        };
      }
      if (table === "lead_activity") {
        return {
          insert: vi.fn(async (r: { note: string }) => {
            notes.push(r.note);
            return { data: null, error: null };
          }),
        };
      }
      return {};
    }),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return { updates, notes };
}

describe("GET /api/cron/renewals — renovaciones del 1 de enero (límite 15-dic)", () => {
  const originalTwilio = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_WHATSAPP_NUMBER,
  };

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.TWILIO_WHATSAPP_NUMBER = "+15551234567";
    twilioCreateSpy.mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalTwilio.sid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = originalTwilio.sid;
    if (originalTwilio.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalTwilio.token;
    if (originalTwilio.from === undefined) delete process.env.TWILIO_WHATSAPP_NUMBER;
    else process.env.TWILIO_WHATSAPP_NUMBER = originalTwilio.from;
  });

  // El cron corre a las 14:00 UTC (vercel.json) = 10:00 en Florida.
  const run = async (isoDate: string) => {
    vi.setSystemTime(new Date(`${isoDate}T14:00:00Z`));
    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    return res.json();
  };

  it("31-oct: no hace nada", async () => {
    const db = installEneroDb([row()]);
    const body = await run("2026-10-31");
    expect(twilioCreateSpy).not.toHaveBeenCalled();
    expect(db.updates).toHaveLength(0);
    expect(body.reminders_60).toBe(0);
  });

  it("1-nov: primer recordatorio (nota para el agente), marca reminder_60_sent y no escribe al cliente", async () => {
    const db = installEneroDb([row()]);
    const body = await run("2026-11-01");
    expect(body.reminders_60).toBe(1);
    expect(twilioCreateSpy).not.toHaveBeenCalled();
    expect(db.updates).toEqual([{ id: "rr-1", payload: { reminder_60_sent: true } }]);
    expect(db.notes).toEqual([
      "Recordatorio: ya abrió la inscripción para 2027. Mándale el mensaje de renovación por WhatsApp desde su ficha. El límite es el 15 de diciembre.",
    ]);
  });

  it("2-nov: la lógica de 60 días no duplica el aviso de una renovación del 1 de enero", async () => {
    // El 2-nov la fecha a 60 días es justo 2027-01-01: la consulta original la
    // devuelve, pero se excluye y solo actúa la lógica del 1 de enero.
    const db = installEneroDb([row()]);
    const body = await run("2026-11-02");
    expect(body.reminders_60).toBe(1);
    expect(db.updates).toHaveLength(1);
    expect(db.notes).toHaveLength(1);
    expect(db.notes[0]).not.toContain("Recordatorio 60 días");
  });

  it("3-nov sin enviar todavía: sale el primero (recupera el día perdido)", async () => {
    const db = installEneroDb([row()]);
    const body = await run("2026-11-03");
    expect(body.reminders_60).toBe(1);
    expect(db.updates[0].payload).toEqual({ reminder_60_sent: true });
  });

  it("1-dic: segundo recordatorio como nota interna", async () => {
    const db = installEneroDb([row({ reminder_60_sent: true })]);
    const body = await run("2026-12-01");
    expect(body.reminders_30).toBe(1);
    expect(twilioCreateSpy).not.toHaveBeenCalled();
    expect(db.updates[0].payload).toEqual({ reminder_30_sent: true });
    expect(db.notes).toContain("Recordatorio: faltan 14 días para el 15 de diciembre");
  });

  it("10-dic: tercer recordatorio como nota interna", async () => {
    const db = installEneroDb([row({ reminder_60_sent: true, reminder_30_sent: true })]);
    const body = await run("2026-12-10");
    expect(body.reminders_15).toBe(1);
    expect(db.updates[0].payload).toEqual({ reminder_15_sent: true });
    expect(db.notes.some((n) => n.includes("Recordatorio: faltan 5 días para el 15 de diciembre"))).toBe(true);
  });

  it("10-dic, cartera importada tarde: primero el primero, un aviso por corrida", async () => {
    const db = installEneroDb([row()]);
    const body = await run("2026-12-10");
    expect(body.reminders_60).toBe(1);
    expect(body.reminders_15).toBe(0);
    expect(db.updates).toEqual([{ id: "rr-1", payload: { reminder_60_sent: true } }]);
  });

  it("15-dic: todavía antes del límite (faltan 0 días)", async () => {
    const db = installEneroDb([row({ reminder_60_sent: true, reminder_30_sent: true })]);
    await run("2026-12-15");
    expect(db.updates[0].payload).toEqual({ reminder_15_sent: true });
  });

  it("16-dic sin enviar: no sale el primero, marca las tres banderas y deja la nota", async () => {
    const db = installEneroDb([row()]);
    const body = await run("2026-12-16");
    expect(twilioCreateSpy).not.toHaveBeenCalled();
    expect(body.pasado_limite).toBe(1);
    expect(db.updates).toEqual([
      { id: "rr-1", payload: { reminder_60_sent: true, reminder_30_sent: true, reminder_15_sent: true } },
    ]);
    expect(db.notes).toEqual([
      "Pasó el 15 de diciembre: si se inscribe antes del 15 de enero, la cobertura empieza el 1 de febrero.",
    ]);
  });

  it("16-dic con todo enviado: no hace nada", async () => {
    const db = installEneroDb([row({ reminder_60_sent: true, reminder_30_sent: true, reminder_15_sent: true })]);
    await run("2026-12-16");
    expect(db.updates).toHaveLength(0);
    expect(db.notes).toHaveLength(0);
  });

  it("16-ene: fuera de la ventana, no toca nada", async () => {
    const db = installEneroDb([row({ renewal_date: "2027-01-01" })]);
    await run("2027-01-16");
    expect(db.updates).toHaveLength(0);
  });

  it("ninguna nota contiene \"$?\" ni \"Vi que te interesa\"", async () => {
    const all: string[] = [];
    for (const [date, r] of [
      ["2026-11-01", row()],
      ["2026-12-01", row({ reminder_60_sent: true })],
      ["2026-12-10", row({ reminder_60_sent: true, reminder_30_sent: true })],
      ["2026-12-16", row()],
    ] as const) {
      const db = installEneroDb([r]);
      await run(date);
      all.push(...db.notes);
    }
    expect(twilioCreateSpy).not.toHaveBeenCalled();
    expect(all.length).toBeGreaterThan(0);
    for (const text of all) {
      expect(text).not.toContain("$?");
      expect(text).not.toContain("Vi que te interesa");
    }
  });
});
