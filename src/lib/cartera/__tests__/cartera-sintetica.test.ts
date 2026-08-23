import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseCsv,
  suggestMapping,
  applyMapping,
  coerceNumber,
  coerceInt,
  coerceBoolean,
  coerceMetal,
  coerceDate,
} from "../csv";
import { scorePortfolioClient } from "../scoring";

// The synthetic 100-client fixture shipped in the repo must import cleanly
// end-to-end and exercise all four risk levels, so the Preview demo shows a
// realistic spread. 100% synthetic data: 555 phones, @example.com emails.
describe("scripts/cartera-sintetica.csv", () => {
  const text = readFileSync(
    join(process.cwd(), "scripts", "cartera-sintetica.csv"),
    "utf-8"
  );
  const { headers, rows } = parseCsv(text);
  const mapping = suggestMapping(headers);
  const REF = new Date("2026-11-01T12:00:00Z");

  it("has 100 data rows and every column maps automatically", () => {
    expect(rows).toHaveLength(100);
    expect(mapping).not.toContain(null);
    expect(mapping).toContain("full_name");
  });

  it("contains only synthetic contact data", () => {
    const phoneCol = mapping.indexOf("phone");
    const emailCol = mapping.indexOf("email");
    for (const r of rows) {
      expect(r[phoneCol]).toContain("555-");
      expect(r[emailCol]).toMatch(/@example\.com$/);
    }
  });

  it("imports 100/100 valid rows and produces all four risk levels", () => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    let valid = 0;
    for (const r of rows) {
      const m = applyMapping(mapping, r);
      if (!m.full_name) continue;
      valid++;
      const a = scorePortfolioClient(
        {
          dateOfBirth: m.date_of_birth ? coerceDate(m.date_of_birth) : null,
          householdMembers: m.household_members ? coerceInt(m.household_members) : null,
          estimatedAnnualIncome: m.estimated_annual_income
            ? coerceNumber(m.estimated_annual_income)
            : null,
          metalLevel: m.metal_level ? coerceMetal(m.metal_level) : null,
          monthlyPremium: m.monthly_premium ? coerceNumber(m.monthly_premium) : null,
          monthlySubsidy: m.monthly_subsidy ? coerceNumber(m.monthly_subsidy) : null,
          autoRenewal: m.auto_renewal ? coerceBoolean(m.auto_renewal) : null,
        },
        REF
      );
      counts[a.riskLevel]++;
    }
    expect(valid).toBe(100);
    expect(counts.critical).toBeGreaterThan(0);
    expect(counts.high).toBeGreaterThan(0);
    expect(counts.medium).toBeGreaterThan(0);
    expect(counts.low).toBeGreaterThan(0);
  });

  it("critical scores are dispersed, not piled at 100 (Fase B calibration)", () => {
    // The Fase A formula clamped 21 of these clients at min(100, 105); after
    // recalibration the fixture's criticals must rank against each other.
    const criticalScores: number[] = [];
    for (const r of rows) {
      const m = applyMapping(mapping, r);
      if (!m.full_name) continue;
      const a = scorePortfolioClient(
        {
          dateOfBirth: m.date_of_birth ? coerceDate(m.date_of_birth) : null,
          householdMembers: m.household_members ? coerceInt(m.household_members) : null,
          estimatedAnnualIncome: m.estimated_annual_income
            ? coerceNumber(m.estimated_annual_income)
            : null,
          metalLevel: m.metal_level ? coerceMetal(m.metal_level) : null,
          monthlyPremium: m.monthly_premium ? coerceNumber(m.monthly_premium) : null,
          monthlySubsidy: m.monthly_subsidy ? coerceNumber(m.monthly_subsidy) : null,
          autoRenewal: m.auto_renewal ? coerceBoolean(m.auto_renewal) : null,
        },
        REF
      );
      if (a.riskLevel === "critical") criticalScores.push(a.riskScore);
    }
    // No client in this fixture has the absolute-worst profile → nobody at 100.
    expect(criticalScores.filter((s) => s === 100)).toHaveLength(0);
    // Real ranking: plenty of distinct values among the criticals.
    const distinct = new Set(criticalScores);
    expect(distinct.size).toBeGreaterThanOrEqual(10);
  });
});
