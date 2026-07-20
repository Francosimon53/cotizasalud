import { describe, it, expect } from "vitest";
import {
  scorePortfolioClient,
  riskLevelFor,
  confidenceFor,
  ageFrom,
} from "../scoring";
import { fplForHousehold, fplPercent } from "../fpl";
import { RAZONES_ES, NIVELES_ES } from "../razones";
import type { RiskReason, RiskLevel } from "../scoring";

// Fixed reference date so age math is deterministic (OEP 2027 renewal window).
const REF = new Date("2026-11-01T12:00:00Z");

describe("fpl", () => {
  it("computes 2026 guideline for household sizes", () => {
    expect(fplForHousehold(1)).toBe(15_960);
    expect(fplForHousehold(4)).toBe(33_000);
  });

  it("treats zero/negative household as 1", () => {
    expect(fplForHousehold(0)).toBe(15_960);
    expect(fplForHousehold(-2)).toBe(15_960);
  });

  it("computes FPL percent", () => {
    expect(fplPercent(15_960, 1)).toBeCloseTo(100);
    expect(fplPercent(66_000, 4)).toBeCloseTo(200);
  });
});

describe("riskLevelFor thresholds", () => {
  it("maps scores to levels at the documented boundaries", () => {
    expect(riskLevelFor(0)).toBe("low");
    expect(riskLevelFor(19)).toBe("low");
    expect(riskLevelFor(20)).toBe("medium");
    expect(riskLevelFor(39)).toBe("medium");
    expect(riskLevelFor(40)).toBe("high");
    expect(riskLevelFor(69)).toBe("high");
    expect(riskLevelFor(70)).toBe("critical");
    expect(riskLevelFor(100)).toBe("critical");
  });
});

describe("scorePortfolioClient", () => {
  it("client with no data beyond name scores 0 / low with 0 confidence", () => {
    const r = scorePortfolioClient({}, REF);
    expect(r.riskScore).toBe(0);
    expect(r.riskLevel).toBe("low");
    expect(r.riskReasons).toEqual([]);
    expect(r.scoreConfidence).toBe(0);
  });

  it("minimal CSV (only name and premium) scores without crashing", () => {
    // Premium alone can't compute the dependency ratio (subsidy unknown).
    const r = scorePortfolioClient({ monthlyPremium: 450 }, REF);
    expect(r.riskScore).toBe(0);
    expect(r.riskLevel).toBe("low");
    expect(r.scoreConfidence).toBe(Math.round((1 / 7) * 100));
  });

  it("subsidy 0 with premium present adds no dependency points but counts confidence", () => {
    const r = scorePortfolioClient({ monthlyPremium: 500, monthlySubsidy: 0 }, REF);
    expect(r.riskScore).toBe(0);
    expect(r.riskReasons).not.toContain("subsidy_dependent");
    expect(r.scoreConfidence).toBe(Math.round((2 / 7) * 100));
  });

  it("full subsidy dependency scores the 30-point maximum", () => {
    const r = scorePortfolioClient({ monthlyPremium: 0, monthlySubsidy: 600 }, REF);
    expect(r.riskScore).toBe(30);
    expect(r.riskReasons).toContain("subsidy_dependent");
  });

  it("dependency below 50% adds points but not the reason", () => {
    // ratio = 200 / (300 + 200) = 0.4 → 12 pts, no flag
    const r = scorePortfolioClient({ monthlyPremium: 300, monthlySubsidy: 200 }, REF);
    expect(r.riskScore).toBe(12);
    expect(r.riskReasons).not.toContain("subsidy_dependent");
  });

  it("income over 400% FPL for household of 1 triggers the cliff", () => {
    // 400% for 1 = 63,840
    const r = scorePortfolioClient({ estimatedAnnualIncome: 70_000 }, REF);
    expect(r.riskScore).toBe(25);
    expect(r.riskReasons).toContain("subsidy_cliff");
  });

  it("same income does NOT trigger the cliff for a household of 6", () => {
    // FPL for 6 = 15,960 + 5*5,680 = 44,360; 400% = 177,440
    const r = scorePortfolioClient(
      { estimatedAnnualIncome: 70_000, householdMembers: 6 },
      REF
    );
    expect(r.riskReasons).not.toContain("subsidy_cliff");
    // Household of 6 still flags large_household (+10)
    expect(r.riskReasons).toContain("large_household");
    expect(r.riskScore).toBe(10);
  });

  it("household of 1 vs 6: only the larger household gets the family-size points", () => {
    const solo = scorePortfolioClient({ householdMembers: 1 }, REF);
    const familia = scorePortfolioClient({ householdMembers: 6 }, REF);
    expect(solo.riskScore).toBe(0);
    expect(familia.riskScore).toBe(10);
  });

  it("missing income adds no cliff points (does not assume eligibility loss)", () => {
    const r = scorePortfolioClient({ householdMembers: 2 }, REF);
    expect(r.riskReasons).not.toContain("subsidy_cliff");
  });

  it("age 55+ from date_of_birth (birthday not yet reached counts correctly)", () => {
    // Born 1971-12-15 → 54 on 2026-11-01 (birthday pending) → no flag
    const younger = scorePortfolioClient({ dateOfBirth: "1971-12-15" }, REF);
    expect(younger.riskReasons).not.toContain("age_55_plus");
    // Born 1971-06-15 → 55 on 2026-11-01 → flag
    const older = scorePortfolioClient({ dateOfBirth: "1971-06-15" }, REF);
    expect(older.riskReasons).toContain("age_55_plus");
    expect(older.riskScore).toBe(15);
  });

  it("estimated_age works when date_of_birth is absent", () => {
    const r = scorePortfolioClient({ estimatedAge: 61 }, REF);
    expect(r.riskReasons).toContain("age_55_plus");
  });

  it("invalid date_of_birth is ignored", () => {
    const r = scorePortfolioClient({ dateOfBirth: "not-a-date" }, REF);
    expect(r.riskScore).toBe(0);
    expect(ageFrom({ dateOfBirth: "not-a-date" }, REF)).toBeNull();
  });

  it("bronze plan and auto-renewal add their weights", () => {
    const r = scorePortfolioClient({ metalLevel: "bronze", autoRenewal: true }, REF);
    expect(r.riskScore).toBe(25);
    expect(r.riskReasons).toEqual(
      expect.arrayContaining(["bronze_plan", "auto_renewal_shock"])
    );
  });

  it("auto_renewal false adds nothing but counts toward confidence", () => {
    const r = scorePortfolioClient({ autoRenewal: false }, REF);
    expect(r.riskScore).toBe(0);
    expect(r.scoreConfidence).toBe(Math.round((1 / 7) * 100));
  });

  it("worst case caps at 100 and is critical", () => {
    // Raw sum: 30 + 25 + 15 + 10 + 15 + 10 = 105 → capped
    const r = scorePortfolioClient(
      {
        monthlyPremium: 0,
        monthlySubsidy: 800,
        estimatedAnnualIncome: 200_000,
        householdMembers: 4,
        estimatedAge: 60,
        metalLevel: "bronze",
        autoRenewal: true,
      },
      REF
    );
    expect(r.riskScore).toBe(100);
    expect(r.riskLevel).toBe("critical");
    expect(r.scoreConfidence).toBe(100);
  });

  it("confidence counts age once whether dob or estimated_age is present", () => {
    expect(confidenceFor({ dateOfBirth: "1980-01-01" })).toBe(
      confidenceFor({ estimatedAge: 46 })
    );
    expect(confidenceFor({ dateOfBirth: "1980-01-01", estimatedAge: 46 })).toBe(
      Math.round((1 / 7) * 100)
    );
  });
});

describe("razones (traducciones de UI)", () => {
  it("every reason key has a Spanish phrase", () => {
    const keys: RiskReason[] = [
      "subsidy_dependent",
      "subsidy_cliff",
      "age_55_plus",
      "bronze_plan",
      "auto_renewal_shock",
      "large_household",
    ];
    for (const k of keys) {
      expect(RAZONES_ES[k]).toBeTruthy();
      expect(RAZONES_ES[k]).not.toMatch(/[a-z]_[a-z]/); // no raw keys leak
    }
  });

  it("every risk level has a Spanish label", () => {
    const levels: RiskLevel[] = ["critical", "high", "medium", "low"];
    for (const l of levels) expect(NIVELES_ES[l]).toBeTruthy();
  });
});
