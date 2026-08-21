import { describe, expect, it } from "vitest";
import {
  coerceDate,
  coercePremium,
  mapStatus,
  nextRenewalDate,
} from "../renewal-date";

const AUG_2026 = new Date("2026-08-18T12:00:00Z");

describe("nextRenewalDate", () => {
  it("returns the coming January 1 for a policy that started years ago", () => {
    // The regression this replaces: effective + 365 days wrote 2024-01-01 for
    // this row, a date in the past, so /api/cron/renewals never matched it.
    expect(nextRenewalDate("2023-01-01", AUG_2026)).toBe("2027-01-01");
  });

  it("returns the coming January 1 for a mid-year SEP start", () => {
    expect(nextRenewalDate("2026-04-01", AUG_2026)).toBe("2027-01-01");
  });

  it("renews a January 1 policy twelve months out, not the same day", () => {
    expect(nextRenewalDate("2026-01-01", AUG_2026)).toBe("2027-01-01");
  });

  it("anchors on coverage that has not started yet", () => {
    expect(nextRenewalDate("2027-01-01", AUG_2026)).toBe("2028-01-01");
  });

  it("never returns a date in the past", () => {
    const dates = ["2019-05-01", "2020-01-01", "2023-11-15", "2026-08-01"];
    for (const d of dates) {
      const renewal = nextRenewalDate(d, AUG_2026)!;
      expect(new Date(`${renewal}T00:00:00Z`).getTime()).toBeGreaterThan(AUG_2026.getTime());
    }
  });

  it("returns null when the file has no effective date", () => {
    expect(nextRenewalDate(null, AUG_2026)).toBeNull();
    expect(nextRenewalDate("", AUG_2026)).toBeNull();
    expect(nextRenewalDate("no es una fecha", AUG_2026)).toBeNull();
  });
});

describe("coerceDate", () => {
  it("accepts ISO", () => {
    expect(coerceDate("2026-04-01")).toBe("2026-04-01");
    expect(coerceDate("2026-4-1")).toBe("2026-04-01");
  });

  it("accepts US slash dates and pads them", () => {
    expect(coerceDate("1/1/2026")).toBe("2026-01-01");
    expect(coerceDate("04/09/2026")).toBe("2026-04-09");
  });

  it("reads D/M/YYYY when the first number cannot be a month", () => {
    expect(coerceDate("25/12/2026")).toBe("2026-12-25");
  });

  it("expands two-digit years", () => {
    expect(coerceDate("1/1/26")).toBe("2026-01-01");
  });

  it("rejects garbage instead of inventing a date", () => {
    expect(coerceDate("N/A")).toBeNull();
    expect(coerceDate("")).toBeNull();
    expect(coerceDate("13/13/2026")).toBeNull();
    expect(coerceDate(null)).toBeNull();
  });
});

describe("mapStatus", () => {
  it("treats an existing book client as enrolled", () => {
    for (const v of ["Active", "ACTIVE", "activo", "Enrolled", "In Force", "Effectuated", "Vigente"]) {
      expect(mapStatus(v)).toBe("enrolled");
    }
  });

  it("leaves anything else as a new lead", () => {
    for (const v of ["Terminated", "Cancelado", "Pending", "", null, undefined]) {
      expect(mapStatus(v)).toBe("new");
    }
  });

  it("never treats a negative status as enrolled", () => {
    for (const v of [
      "Inactive", "INACTIVE", "Inactivo", "Inactiva", "No activo", "Not active",
      "Coverage ended", "Cancelled", "Expired", "Vencido", "Suspendido",
    ]) {
      expect(mapStatus(v)).toBe("new");
    }
  });

  it("checks negative words before positive ones (substring trap)", () => {
    // "Inactivo" contains "activo"; the negative list must win regardless.
    expect("inactivo".includes("activo")).toBe(true);
    expect(mapStatus("Inactivo")).toBe("new");
  });
});

describe("coercePremium", () => {
  it("strips currency formatting", () => {
    expect(coercePremium("$1,234.56")).toBe(1234.56);
    expect(coercePremium("0")).toBe(0);
    expect(coercePremium(" 116.24 ")).toBe(116.24);
  });

  it("returns null rather than NaN", () => {
    expect(coercePremium("")).toBeNull();
    expect(coercePremium("gratis")).toBeNull();
    expect(coercePremium(null)).toBeNull();
  });
});
