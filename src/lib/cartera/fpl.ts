// 2026 HHS Poverty Guidelines — 48 contiguous states + D.C.
// Source: ASPE, published in the Federal Register on 2026-01-15
// (https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines).
// These are the guidelines in effect for Plan Year 2027 subsidy eligibility,
// i.e. the November 2026 renewal this module targets. Update when the 2027
// guidelines are published (January 2027) if this module outlives OEP 2027.
export const FPL_BASE = 15_960;
export const FPL_PER_ADDITIONAL_MEMBER = 5_680;

// ARPA's enhanced subsidies expired at the end of 2025, so the 400% FPL
// "subsidy cliff" is back: above it there is zero APTC eligibility.
export const SUBSIDY_CLIFF_FPL_PERCENT = 400;

export function fplForHousehold(householdMembers: number): number {
  const members = Math.max(1, Math.floor(householdMembers));
  return FPL_BASE + (members - 1) * FPL_PER_ADDITIONAL_MEMBER;
}

export function fplPercent(annualIncome: number, householdMembers: number): number {
  return (annualIncome / fplForHousehold(householdMembers)) * 100;
}
