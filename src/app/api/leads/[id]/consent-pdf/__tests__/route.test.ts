import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/auth/require-agent", () => ({
  requireAuthenticatedAgent: vi.fn(),
}));

import { GET } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { NextResponse } from "next/server";

type Agent = { id: string; slug: string; is_active?: boolean };

function makeRequest(): any {
  return {} as any;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function setAuthOk(agent: Agent) {
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

interface FullLead {
  id: string;
  agent_id: string;
  agent_slug: string;
  contact_name: string;
  first_name: string;
  last_name: string;
  contact_phone: string;
  contact_email: string;
  dob: string;
  annual_income: number;
  signature_data: string;
  consent_ip: string;
  consent_timestamp: string;
  selected_plan: Record<string, unknown> | null;
  selected_plan_name: string | null;
  selected_premium: number | null;
  created_at: string;
}

const fullLead: FullLead = {
  id: "lead-1",
  agent_id: "a1",
  agent_slug: "alice",
  contact_name: "Maria Lopez",
  first_name: "Maria",
  last_name: "Lopez",
  contact_phone: "2395551234",
  contact_email: "maria@example.com",
  dob: "1985-04-12",
  annual_income: 28000,
  signature_data: "",
  consent_ip: "203.0.113.50",
  consent_timestamp: "2026-04-30T14:00:00Z",
  selected_plan: null,
  selected_plan_name: "Ambetter Gold",
  selected_premium: 85,
  created_at: "2026-04-29T12:00:00Z",
};

function installDb(opts: { lead?: Partial<FullLead> | null; consent?: Record<string, unknown> | null }) {
  const lead = opts.lead === undefined ? fullLead : opts.lead === null ? null : { ...fullLead, ...opts.lead };
  const consent = opts.consent ?? null;

  const db = {
    from: vi.fn((table: string) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: lead, error: lead ? null : { code: "PGRST116" } }),
            }),
          }),
        };
      }
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { name: "Alice Agent", npn: "123", agency_name: "Test", phone: "555-0000" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "consents") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  single: async () => ({ data: consent, error: consent ? null : { code: "PGRST116" } }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  };

  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return db;
}

// Fila de consents con firma escrita real. Fecha y firma distintas de las
// del lead para probar de dónde sale cada una.
const SIGNED_CONSENT = {
  lead_id: "lead-1",
  consumer_name: "Maria Lopez",
  typed_signature: "Maria L. Firma Real",
  consumer_signature: null,
  consent_date: "2026-03-15",
  ip_address: "198.51.100.7",
  created_at: "2026-03-15T15:00:00Z",
};

// PNG 1x1 válido (firma dibujada legacy).
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function pdfText(buf: Buffer): string {
  return buf.toString("latin1");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/leads/[id]/consent-pdf", () => {
  it("returns 401 when no auth user is present", async () => {
    setAuthError(401, "Authentication required");
    installDb({});

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(401);
  });

  it("returns 200 with a PDF when ownership matches and the client signed", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ consent: SIGNED_CONSENT });

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
  });

  it("returns 403 (NOT a PDF) when the lead belongs to another agent (anti-IDOR)", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ lead: { agent_id: "victim-agent" } });

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).not.toBe("application/pdf");
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("sin consentimiento: 404 con { error: 'sin_consentimiento' } y cero bytes de PDF", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    // Lead con consent_timestamp pero sin firma, y sin fila en consents.
    installDb({ consent: null });

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).not.toBe("application/pdf");
    const raw = await res.text();
    expect(raw.startsWith("%PDF")).toBe(false);
    expect(JSON.parse(raw)).toEqual({ error: "sin_consentimiento" });
  });

  it("una fila de consents con la firma vacía no cuenta como evidencia", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ consent: { ...SIGNED_CONSENT, typed_signature: "   ", consumer_signature: "" } });

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(404);
  });

  it("sin evidencia, el nombre del cliente nunca aparece como firma", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ consent: null, lead: { signature_data: "", consent_timestamp: "" } });

    const res = await GET(makeRequest(), makeParams("lead-1"));
    const raw = await res.text();

    expect(res.status).toBe(404);
    expect(raw).not.toContain("Maria Lopez");
    expect(raw).not.toContain("Firma del Cliente");
  });

  it("con consentimiento: el PDF lleva la firma y la fecha de la fila de consents", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ consent: SIGNED_CONSENT });

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(200);
    const text = pdfText(Buffer.from(await res.arrayBuffer()));
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toContain("Maria L. Firma Real");
    expect(text).toContain("15 de marzo de 2026");
    expect(text).toContain("198.51.100.7");
    // Ni la fecha del lead ni created_at se usan como fecha de firma.
    expect(text).not.toContain("30 de abril de 2026");
    expect(text).not.toContain("29 de abril de 2026");
  });

  it("con firma legacy (signature_data + consent_timestamp): PDF válido", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ consent: null, lead: { signature_data: PNG_1X1, consent_timestamp: "2026-04-30T14:00:00Z" } });

    const res = await GET(makeRequest(), makeParams("lead-1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const text = pdfText(Buffer.from(await res.arrayBuffer()));
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toContain("30 de abril de 2026");
    expect(text).toContain("203.0.113.50");
  });

  it("sin IP registrada no imprime 'IP N/A'", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({ consent: { ...SIGNED_CONSENT, ip_address: null }, lead: { consent_ip: "" } });

    const res = await GET(makeRequest(), makeParams("lead-1"));
    const text = pdfText(Buffer.from(await res.arrayBuffer()));

    expect(res.status).toBe(200);
    expect(text).not.toContain("IP N/A");
    expect(text).toContain("Firmado digitalmente el 15 de marzo de 2026");
  });
});
