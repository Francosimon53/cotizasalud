import { afterEach, describe, expect, it } from "vitest";

import { derivePlanYear } from "../plan-year";

const originalPlanYear = process.env.PLAN_YEAR;

afterEach(() => {
  if (originalPlanYear === undefined) delete process.env.PLAN_YEAR;
  else process.env.PLAN_YEAR = originalPlanYear;
});

// Mediodía en Florida (16:00 UTC) para que la fecha no dependa de la zona del runner.
const at = (isoDate: string) => new Date(`${isoDate}T16:00:00Z`);

describe("derivePlanYear", () => {
  it.each([
    ["2026-10-31", 2026],
    ["2026-11-01", 2027],
    ["2026-12-31", 2027],
    ["2027-01-15", 2027],
  ])("%s → %i", (date, year) => {
    delete process.env.PLAN_YEAR;
    expect(derivePlanYear(at(date))).toBe(year);
  });

  it("el 1 de noviembre a las 00:30 de Florida ya es 2027 (aunque en UTC sea 1-nov 04:30)", () => {
    delete process.env.PLAN_YEAR;
    expect(derivePlanYear(new Date("2026-11-01T04:30:00Z"))).toBe(2027);
    // 31-oct 23:30 en Florida = 1-nov 03:30 UTC: todavía 2026.
    expect(derivePlanYear(new Date("2026-11-01T03:30:00Z"))).toBe(2026);
  });

  it("PLAN_YEAR sigue funcionando como override", () => {
    process.env.PLAN_YEAR = "2030";
    expect(derivePlanYear(at("2026-10-31"))).toBe(2030);
    expect(derivePlanYear(at("2026-11-01"))).toBe(2030);
  });

  it("ignora un PLAN_YEAR que no sea de cuatro dígitos", () => {
    process.env.PLAN_YEAR = "27";
    expect(derivePlanYear(at("2026-11-01"))).toBe(2027);
  });
});
