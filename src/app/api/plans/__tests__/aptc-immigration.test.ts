// aptc_eligible por miembro según el estatus migratorio del solicitante
// principal. Se inspecciona el cuerpo que la ruta manda al CMS API.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const originalPlanYear = process.env.PLAN_YEAR;
let fetchMock: ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): any {
  return {
    json: async () => body,
    headers: { get: () => "203.0.113.42" },
  };
}

// Hogar: principal + hijo/a.
function body(extra: Record<string, unknown> = {}, primary: Record<string, unknown> = {}) {
  return {
    zipcode: "33914",
    countyfips: "12071",
    state: "FL",
    income: 32000,
    household: [
      { age: 40, gender: "Female", tobacco: false, ...primary },
      { age: 10, gender: "Male", tobacco: false },
    ],
    ...extra,
  };
}

async function sentPeople(reqBody: unknown) {
  await POST(makeRequest(reqBody));
  expect(fetchMock).toHaveBeenCalled();
  const init = fetchMock.mock.calls[0][1] as { body: string };
  const sent = JSON.parse(init.body);
  return { people: sent.household.people as Array<{ aptc_eligible: boolean }>, year: sent.year as number };
}

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ plans: [], total: 0 }),
    text: async () => "",
    status: 200,
  }));
  vi.stubGlobal("fetch", fetchMock);
  process.env.CMS_API_KEY = "test-key";
});

afterEach(() => {
  if (originalPlanYear === undefined) delete process.env.PLAN_YEAR;
  else process.env.PLAN_YEAR = originalPlanYear;
});

describe("POST /api/plans — subsidio según estatus migratorio", () => {
  it("2027 + tps: el principal va sin subsidio y el hijo con subsidio", async () => {
    process.env.PLAN_YEAR = "2027";
    const { people, year } = await sentPeople(body({ immigrationStatus: "tps" }));
    expect(year).toBe(2027);
    expect(people[0].aptc_eligible).toBe(false);
    expect(people[1].aptc_eligible).toBe(true);
  });

  it("2026 + tps: con subsidio (no cambia nada para planes 2026)", async () => {
    process.env.PLAN_YEAR = "2026";
    const { people } = await sentPeople(body({ immigrationStatus: "tps" }));
    expect(people.map((p) => p.aptc_eligible)).toEqual([true, true]);
  });

  it("2027 + citizen: con subsidio", async () => {
    process.env.PLAN_YEAR = "2027";
    const { people } = await sentPeople(body({ immigrationStatus: "citizen" }));
    expect(people.map((p) => p.aptc_eligible)).toEqual([true, true]);
  });

  it.each(["temporary_visa", "refugee", "daca", "no_status"])("2027 + %s: el principal sin subsidio", async (status) => {
    process.env.PLAN_YEAR = "2027";
    const { people } = await sentPeople(body({ immigrationStatus: status }));
    expect(people[0].aptc_eligible).toBe(false);
    expect(people[1].aptc_eligible).toBe(true);
  });

  it("2027 + cofa: con subsidio", async () => {
    process.env.PLAN_YEAR = "2027";
    const { people } = await sentPeople(body({ immigrationStatus: "cofa" }));
    expect(people[0].aptc_eligible).toBe(true);
  });

  it("2027 sin estatus o con un valor fuera de la lista: con subsidio", async () => {
    process.env.PLAN_YEAR = "2027";
    expect((await sentPeople(body())).people[0].aptc_eligible).toBe(true);
    fetchMock.mockClear();
    expect((await sentPeople(body({ immigrationStatus: "TPS; DROP" }))).people[0].aptc_eligible).toBe(true);
  });

  it("hasEmployerCoverage sigue dejando sin subsidio a ese miembro, en cualquier año", async () => {
    for (const year of ["2026", "2027"]) {
      process.env.PLAN_YEAR = year;
      fetchMock.mockClear();
      const { people } = await sentPeople(body({ immigrationStatus: "citizen" }, { hasEmployerCoverage: true }));
      expect(people.map((p) => p.aptc_eligible)).toEqual([false, true]);
    }
  });

  it("la respuesta al consumidor no menciona el estatus", async () => {
    process.env.PLAN_YEAR = "2027";
    const res = await POST(makeRequest(body({ immigrationStatus: "tps" })));
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/tps|immigration|estatus|migratori/i);
  });
});
