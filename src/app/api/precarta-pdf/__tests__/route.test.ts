import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/auth/require-agent", () => ({
  requireAuthenticatedAgent: vi.fn(),
}));

import { GET, POST } from "../route";
import { createServiceClient } from "@/lib/supabase";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { NextResponse } from "next/server";

// Firma dibujada mínima (PNG 1x1). Suficiente para que jsPDF la acepte.
const FIRMA_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let ipSeq = 0;
function ipNueva() {
  ipSeq += 1;
  return `198.51.100.${ipSeq}`;
}

function makePostRequest(body: unknown, ip = ipNueva()) {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => (name.toLowerCase() === "x-forwarded-for" ? ip : null),
    },
  } as unknown as Parameters<typeof POST>[0];
}

function makeGetRequest(leadId: string | null) {
  return {
    nextUrl: { searchParams: { get: (k: string) => (k === "leadId" ? leadId : null) } },
    headers: { get: () => null },
  } as unknown as Parameters<typeof GET>[0];
}

const bodyValido = {
  clientName: "Maria Lopez",
  clientDob: "1985-04-12",
  agentName: "Alice Agent",
  agentNPN: "123",
  agentPhone: "555-0000",
  signatureDataUrl: FIRMA_PNG,
  signedAt: "2026-10-16T15:00:00Z",
};

function installStorage(opts: { uploadError?: unknown } = {}) {
  const upload = vi.fn(async (path: string) =>
    opts.uploadError ? { data: null, error: opts.uploadError } : { data: { path }, error: null }
  );
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://example.invalid/publico" } }));
  const fromBucket = vi.fn(() => ({ upload, getPublicUrl }));
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ storage: { from: fromBucket } });
  return { upload, getPublicUrl, fromBucket };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/precarta-pdf (paso de la pre-carta del cotizador)", () => {
  it("guarda el PDF en el bucket privado y no devuelve ni el PDF ni una URL pública", async () => {
    const { upload, getPublicUrl, fromBucket } = installStorage();
    const res = await POST(makePostRequest(bodyValido));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.fileName).toMatch(/^PreCarta_Maria_Lopez_\d{4}-\d{2}-\d{2}_\d+\.pdf$/);
    expect(json).not.toHaveProperty("pdfBase64");
    expect(json).not.toHaveProperty("storageUrl");
    expect(fromBucket).toHaveBeenCalledWith("precarta-pdfs");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  it("sin firma dibujada responde 400 y no guarda nada", async () => {
    const { upload } = installStorage();
    const res = await POST(makePostRequest({ ...bodyValido, signatureDataUrl: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("sin_firma");
    expect(upload).not.toHaveBeenCalled();
  });

  it("una firma gigante responde 413 y no guarda nada", async () => {
    const { upload } = installStorage();
    const enorme = "data:image/png;base64," + "A".repeat(600_000);
    const res = await POST(makePostRequest({ ...bodyValido, signatureDataUrl: enorme }));
    expect(res.status).toBe(413);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rechaza nombre vacío o demasiado largo y fecha de nacimiento mal formada", async () => {
    const { upload } = installStorage();
    expect((await POST(makePostRequest({ ...bodyValido, clientName: "" }))).status).toBe(400);
    expect((await POST(makePostRequest({ ...bodyValido, clientName: "x".repeat(200) }))).status).toBe(400);
    expect((await POST(makePostRequest({ ...bodyValido, clientDob: "12/04/1985" }))).status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("una fecha de firma inválida no rompe: usa la hora actual", async () => {
    installStorage();
    const res = await POST(makePostRequest({ ...bodyValido, signedAt: "no-es-fecha" }));
    expect(res.status).toBe(200);
  });

  it("corta con 429 después de 10 pedidos de la misma IP en 5 minutos", async () => {
    installStorage();
    const ip = ipNueva();
    for (let i = 0; i < 10; i++) {
      expect((await POST(makePostRequest(bodyValido, ip))).status).toBe(200);
    }
    expect((await POST(makePostRequest(bodyValido, ip))).status).toBe(429);
    // Otra IP sigue pudiendo.
    expect((await POST(makePostRequest(bodyValido))).status).toBe(200);
  });

  it("si el bucket falla responde 500", async () => {
    installStorage({ uploadError: { message: "boom" } });
    const res = await POST(makePostRequest(bodyValido));
    expect(res.status).toBe(500);
  });
});

// ── GET: guarda del panel del agente (agregada en el PR #73) ──

const leadBase = {
  id: "lead-1",
  agent_id: "a1",
  agent_slug: "alice",
  contact_name: "Maria Lopez",
  first_name: "Maria",
  last_name: "Lopez",
  dob: "1985-04-12",
  signature_data: "",
  consent_ip: "",
  consent_timestamp: "",
  created_at: "2026-10-01T12:00:00Z",
};

function installDb(lead: Record<string, unknown> | null) {
  const db = {
    from: vi.fn((table: string) => {
      if (table === "leads") {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: lead, error: lead ? null : { code: "PGRST116" } }) }),
          }),
        };
      }
      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { name: "Alice Agent", npn: "123", phone: "555-0000" }, error: null }) }),
          }),
        };
      }
      if (table === "consents") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ single: async () => ({ data: null, error: { code: "PGRST116" } }) }) }),
            }),
          }),
        };
      }
      return {};
    }),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
}

function setAuth(agentId: string | null) {
  (requireAuthenticatedAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    agentId
      ? { agent: { id: agentId, slug: "alice" }, user: { id: "user-1" } }
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  );
}

describe("GET /api/precarta-pdf (panel del agente)", () => {
  it("sin sesión de agente responde 401", async () => {
    setAuth(null);
    installDb(leadBase);
    expect((await GET(makeGetRequest("lead-1"))).status).toBe(401);
  });

  it("un lead de otro agente responde 403", async () => {
    setAuth("otro-agente");
    installDb(leadBase);
    expect((await GET(makeGetRequest("lead-1"))).status).toBe(403);
  });

  it("sin evidencia de firma responde 404 sin_consentimiento", async () => {
    setAuth("a1");
    installDb(leadBase);
    const res = await GET(makeGetRequest("lead-1"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("sin_consentimiento");
  });

  it("con firma guardada en el lead devuelve el PDF", async () => {
    setAuth("a1");
    installDb({ ...leadBase, signature_data: FIRMA_PNG, consent_timestamp: "2026-10-01T12:05:00Z", consent_ip: "203.0.113.9" });
    const res = await GET(makeGetRequest("lead-1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });
});
