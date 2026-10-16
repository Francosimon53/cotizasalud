import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));
vi.mock("@/lib/supabase-auth", () => ({
  createServerAuthClient: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));

import { PATCH } from "../route";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";

function mockAuthUser(user: { id: string } | null) {
  (createServerAuthClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
}

function installDb() {
  const updates: Array<Record<string, unknown>> = [];
  const db = {
    from: vi.fn(() => ({
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    })),
  };
  (createServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
  return { updates };
}

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}

const base = { npn: "18748069", phone: "2395550000" };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthUser({ id: "user-1" });
});

describe("PATCH /api/agents/profile — enlace de HealthSherpa", () => {
  it("guarda el ID que viene en el enlace de marketing", async () => {
    const { updates } = installDb();
    const res = await PATCH(makeRequest({ ...base, healthsherpa_link: "https://www.healthsherpa.com/?_agent_id=delbert-useches" }));
    expect(res.status).toBe(200);
    expect(updates[0].healthsherpa_agent_id).toBe("delbert-useches");
  });

  it("un enlace sin _agent_id responde 400 y no guarda nada", async () => {
    const { updates } = installDb();
    const res = await PATCH(makeRequest({ ...base, healthsherpa_link: "https://www.healthsherpa.com/" }));
    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("vacío borra el ID guardado", async () => {
    const { updates } = installDb();
    const res = await PATCH(makeRequest({ ...base, healthsherpa_link: "" }));
    expect(res.status).toBe(200);
    expect(updates[0].healthsherpa_agent_id).toBeNull();
  });

  it("si el campo no viene (registro, onboarding) no se toca", async () => {
    const { updates } = installDb();
    const res = await PATCH(makeRequest({ ...base }));
    expect(res.status).toBe(200);
    expect(updates[0]).not.toHaveProperty("healthsherpa_agent_id");
  });
});
