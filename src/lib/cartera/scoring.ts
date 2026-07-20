import { fplPercent, SUBSIDY_CLIFF_FPL_PERCENT } from "./fpl";

// Renewal-risk scoring for the agent's book of business (Módulo OEP 2027,
// Fase A). Pure function: no I/O, no clock reads (reference date is a
// parameter). Weights, formula and sources are documented in docs/SCORING.md —
// keep both in sync.

export type MetalLevel = "bronze" | "silver" | "gold" | "platinum";
export type RiskLevel = "critical" | "high" | "medium" | "low";

// Reason keys stored in portfolio_clients.risk_reasons; the UI translates
// them to Spanish (src/lib/cartera/razones.ts).
export type RiskReason =
  | "subsidy_dependent"
  | "subsidy_cliff"
  | "age_55_plus"
  | "bronze_plan"
  | "auto_renewal_shock"
  | "large_household";

export interface PortfolioClientSignals {
  dateOfBirth?: string | null;
  estimatedAge?: number | null;
  householdMembers?: number | null;
  estimatedAnnualIncome?: number | null;
  metalLevel?: MetalLevel | null;
  monthlyPremium?: number | null;
  monthlySubsidy?: number | null;
  autoRenewal?: boolean | null;
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: RiskReason[];
  scoreConfidence: number;
}

const WEIGHTS = {
  subsidyDependencyMax: 30,
  subsidyCliff: 25,
  age55Plus: 15,
  autoRenewal: 15,
  bronzePlan: 10,
  largeHousehold: 10,
} as const;

// Dependency ratio at which the client is flagged as subsidy-dependent.
const SUBSIDY_DEPENDENT_RATIO = 0.5;
const AGE_RISK_THRESHOLD = 55;
const LARGE_HOUSEHOLD_MIN = 3;

export function riskLevelFor(score: number): RiskLevel {
  if (score >= 70) return "critical";
  if (score >= 40) return "high";
  if (score >= 20) return "medium";
  return "low";
}

export function ageFrom(
  signals: Pick<PortfolioClientSignals, "dateOfBirth" | "estimatedAge">,
  referenceDate: Date
): number | null {
  if (signals.estimatedAge != null && signals.estimatedAge > 0) {
    return Math.floor(signals.estimatedAge);
  }
  if (!signals.dateOfBirth) return null;
  const dob = new Date(signals.dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    referenceDate.getMonth() < dob.getMonth() ||
    (referenceDate.getMonth() === dob.getMonth() && referenceDate.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function scorePortfolioClient(
  signals: PortfolioClientSignals,
  referenceDate: Date = new Date()
): RiskAssessment {
  let score = 0;
  const reasons: RiskReason[] = [];

  // 1. Subsidy dependency: s / (p + s), scaled 0-30. A client whose premium is
  //    mostly covered by APTC feels the subsidy cut hardest.
  const premium = signals.monthlyPremium;
  const subsidy = signals.monthlySubsidy;
  if (premium != null && subsidy != null && premium + subsidy > 0 && subsidy >= 0 && premium >= 0) {
    const ratio = subsidy / (premium + subsidy);
    score += Math.round(ratio * WEIGHTS.subsidyDependencyMax);
    if (ratio >= SUBSIDY_DEPENDENT_RATIO) reasons.push("subsidy_dependent");
  }

  // 2. Income above 400% FPL: with the enhanced subsidies gone, this client
  //    lost APTC eligibility entirely (the cliff). Missing household size
  //    defaults to 1 (the conservative read for the cliff).
  if (signals.estimatedAnnualIncome != null && signals.estimatedAnnualIncome > 0) {
    const pct = fplPercent(signals.estimatedAnnualIncome, signals.householdMembers ?? 1);
    if (pct > SUBSIDY_CLIFF_FPL_PERCENT) {
      score += WEIGHTS.subsidyCliff;
      reasons.push("subsidy_cliff");
    }
  }

  // 3. Age 55+: higher premiums and a steeper cliff.
  const age = ageFrom(signals, referenceDate);
  if (age != null && age >= AGE_RISK_THRESHOLD) {
    score += WEIGHTS.age55Plus;
    reasons.push("age_55_plus");
  }

  // 4. Bronze: bought on price, most sensitive to increases.
  if (signals.metalLevel === "bronze") {
    score += WEIGHTS.bronzePlan;
    reasons.push("bronze_plan");
  }

  // 5. Auto-renewal: first-bill shock risk.
  if (signals.autoRenewal === true) {
    score += WEIGHTS.autoRenewal;
    reasons.push("auto_renewal_shock");
  }

  // 6. Multi-member household: family premium increase is larger in dollars.
  if (signals.householdMembers != null && signals.householdMembers >= LARGE_HOUSEHOLD_MIN) {
    score += WEIGHTS.largeHousehold;
    reasons.push("large_household");
  }

  const riskScore = Math.min(100, Math.max(0, score));

  return {
    riskScore,
    riskLevel: riskLevelFor(riskScore),
    riskReasons: reasons,
    scoreConfidence: confidenceFor(signals),
  };
}

// Share of scoring signals actually present in the import. Age counts once
// (either date_of_birth or an estimated age).
export function confidenceFor(signals: PortfolioClientSignals): number {
  const present = [
    signals.dateOfBirth != null || signals.estimatedAge != null,
    signals.householdMembers != null,
    signals.estimatedAnnualIncome != null,
    signals.metalLevel != null,
    signals.monthlyPremium != null,
    signals.monthlySubsidy != null,
    signals.autoRenewal != null,
  ].filter(Boolean).length;
  return Math.round((present / 7) * 100);
}
