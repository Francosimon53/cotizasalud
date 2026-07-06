// Immigration eligibility triage rules (OBBBA / H.R.1).
//
// From 2027-01-01 (OEP Nov-Dec 2026) only citizens, lawful permanent
// residents, Cuban/Haitian entrants and COFA migrants keep ACA subsidies.
// Asylum (pending or granted), refugees, TPS and humanitarian parole remain
// eligible through 2026 but LOSE the subsidy on 2027-01-01. DACA is out of
// the Marketplace since Aug-2025.
//
// The flag is a triage aid for the agent, never a legal determination, and
// is never shown to the consumer. Every stored flag is stamped with
// RULES_VERSION so rows can be re-triaged when the rules change.

export const RULES_VERSION = "2026-07";

export const IMMIGRATION_STATUSES = [
  "citizen",
  "lpr",
  "cuban_haitian_entrant",
  "asylum_pending",
  "asylum_granted",
  "refugee",
  "tps",
  "humanitarian_parole",
  "daca",
  "no_status",
  "prefer_not_to_say",
] as const;

export type ImmigrationStatus = (typeof IMMIGRATION_STATUSES)[number];

export type EligibilityFlag = "green" | "yellow" | "red" | "unknown";

const FLAG_BY_STATUS: Record<ImmigrationStatus, EligibilityFlag> = {
  // green — keeps the subsidy in 2026 AND 2027
  citizen: "green",
  lpr: "green",
  cuban_haitian_entrant: "green",
  // yellow — eligible in 2026, LOSES the subsidy on 2027-01-01
  asylum_pending: "yellow",
  asylum_granted: "yellow",
  refugee: "yellow",
  tps: "yellow",
  humanitarian_parole: "yellow",
  // red — out of the Marketplace
  daca: "red",
  no_status: "red",
  // unknown — declined to answer
  prefer_not_to_say: "unknown",
};

// Strict whitelist: anything that is not exactly one of the known values
// (free text, wrong type, tampered payload) is discarded as null so the
// lead flow never breaks on a bad immigrationStatus.
export function normalizeImmigrationStatus(value: unknown): ImmigrationStatus | null {
  if (typeof value !== "string") return null;
  return (IMMIGRATION_STATUSES as readonly string[]).includes(value)
    ? (value as ImmigrationStatus)
    : null;
}

// Omitted / discarded statuses triage as "unknown".
export function eligibilityFlagFor(status: ImmigrationStatus | null | undefined): EligibilityFlag {
  if (!status) return "unknown";
  return FLAG_BY_STATUS[status];
}

// Agent-dashboard copy per flag. Never shown to the consumer.
export const FLAG_COPY: Record<EligibilityFlag, { es: string; en: string }> = {
  green: {
    es: "Elegible con subsidio 2026 y 2027",
    en: "Eligible with subsidy in 2026 and 2027",
  },
  yellow: {
    es: "Elegible 2026 — pierde subsidio el 1-ene-2027. Renovar y planificar ANTES de noviembre",
    en: "Eligible 2026 — loses subsidy on Jan 1, 2027. Renew and plan BEFORE November",
  },
  red: {
    es: "No elegible para Marketplace — canalizar a producto privado",
    en: "Not eligible for the Marketplace — route to a private product",
  },
  unknown: {
    es: "Estatus sin verificar",
    en: "Status not verified",
  },
};

export const PRODUCT_TRACKS = ["aca", "private", "medicare", "medicaid_referral"] as const;

export type ProductTrack = (typeof PRODUCT_TRACKS)[number];

export function isProductTrack(value: unknown): value is ProductTrack {
  return typeof value === "string" && (PRODUCT_TRACKS as readonly string[]).includes(value);
}
