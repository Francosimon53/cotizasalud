export interface County {
  fips: string;
  name: string;
  state: string;
}
export interface HouseholdMember {
  age: number;
  gender: string;
  tobacco: boolean;
  dob?: string;
  hasEmployerCoverage?: boolean;
  isParentGuardian?: boolean;
  isPregnant?: boolean;
}
export interface Plan {
  id: string;
  name: string;
  issuer: string;
  metal: string;
  premium: number;
  aptc: number;
  afterSubsidy: number;
  deductible: number;
  oopMax: number;
  pcp: number;
  specialist: number;
  genericRx: number;
  er: number;
  rating: number;
  hsa: boolean;
  yLow: number;
  yMed: number;
  yHigh: number;
  // Display strings extracted from CMS benefits[].cost_sharings[].display_string.
  // Pre-formatted by CMS — handles flat copays ("$40"), coinsurance
  // ("40% Coinsurance after deductible"), and "No Charge After Deductible".
  // null when the benefit isn't covered or CMS doesn't ship a display string.
  copays_display: {
    primary_care: string | null;
    specialist: string | null;
    urgent_care: string | null;
    emergency_room: string | null;
    mental_health_outpatient: string | null;
    generic_drugs: string | null;
  };
  // Boolean flags for plan-level dental coverage. CMS only surfaces dental
  // benefits in the search response (vision is excluded — lives behind
  // benefits_url). Match any benefit with both "dental" + audience in the
  // name and covered:true.
  dental_coverage: {
    child: boolean;
    adult: boolean;
  };
}
export interface QuoteResults {
  plans: Plan[];
  aptc: number;
  fplPct: number;
}
export interface AgentBrand {
  slug: string;
  name: string;
  npn: string;
  brand_name?: string;
  brand_color?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
}

import type { SubscriptionPlan, SubscriptionStatus } from "./subscription-plans";

export interface Agent {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  npn: string | null;
  agency_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  onboarding_complete: boolean;
  preferred_language: string | null;

  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  subscription_start: string | null;
  subscription_end: string | null;

  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;

  leads_limit_monthly: number;
  leads_count_current_month: number;
  leads_count_reset_at: string;
  trial_end_date: string | null;
  legacy_grace_period_until: string | null;

  created_at: string;
}
