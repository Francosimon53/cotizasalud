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

function installDb(opts: { lead?: Partial<FullLead> | null }) {
  const lead = opts.lead === undefined ? fullLead : opts.lead === null ? null : { ...fullLead, ...opts.lead };

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
                  single: async () => ({ data: null, error: null }),
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

  it("returns 200 with a PDF when ownership matches", async () => {
    setAuthOk({ id: "a1", slug: "alice" });
    installDb({});

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
});
