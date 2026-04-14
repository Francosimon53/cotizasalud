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
