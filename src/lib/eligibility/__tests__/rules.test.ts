import { describe, expect, it } from "vitest";

import {
  FLAG_COPY,
  IMMIGRATION_STATUSES,
  RULES_VERSION,
  eligibilityFlagFor,
  isProductTrack,
  normalizeImmigrationStatus,
} from "../rules";

describe("eligibility rules — 2026-07 (OBBBA/H.R.1)", () => {
  it("pins the rules version stamped on every stored flag", () => {
    expect(RULES_VERSION).toBe("2026-07");
  });

  it.each([
    ["citizen", "green"],
    ["lpr", "green"],
    ["cuban_haitian_entrant", "green"],
    ["asylum_pending", "yellow"],
    ["asylum_granted", "yellow"],
    ["refugee", "yellow"],
    ["tps", "yellow"],
    ["humanitarian_parole", "yellow"],
    ["daca", "red"],
    ["no_status", "red"],
    ["prefer_not_to_say", "unknown"],
  ] as const)("maps %s → %s", (status, flag) => {
    expect(eligibilityFlagFor(status)).toBe(flag);
  });

  it("covers every whitelisted status in the mapping table", () => {
    for (const status of IMMIGRATION_STATUSES) {
      expect(["green", "yellow", "red", "unknown"]).toContain(eligibilityFlagFor(status));
    }
  });

  it("triages an omitted status as unknown", () => {
    expect(eligibilityFlagFor(null)).toBe("unknown");
    expect(eligibilityFlagFor(undefined)).toBe("unknown");
  });

  it("exposes bilingual agent copy for every flag", () => {
    for (const flag of ["green", "yellow", "red", "unknown"] as const) {
      expect(FLAG_COPY[flag].es).toBeTruthy();
      expect(FLAG_COPY[flag].en).toBeTruthy();
    }
    expect(FLAG_COPY.yellow.es).toContain("1-ene-2027");
    expect(FLAG_COPY.red.es).toContain("privado");
  });
});

describe("normalizeImmigrationStatus — strict whitelist", () => {
  it("accepts every whitelisted value verbatim", () => {
    for (const status of IMMIGRATION_STATUSES) {
      expect(normalizeImmigrationStatus(status)).toBe(status);
    }
  });

  it.each([
    "CITIZEN", // case must match exactly
    "green card holder", // free text
    "citizen; DROP TABLE leads", // injection-shaped
    "cofa", // not in the 2026-07 whitelist
    "",
    " citizen",
  ])("discards non-whitelisted string %j as null", (value) => {
    expect(normalizeImmigrationStatus(value)).toBeNull();
  });

  it("discards non-string values as null", () => {
    expect(normalizeImmigrationStatus(undefined)).toBeNull();
    expect(normalizeImmigrationStatus(null)).toBeNull();
    expect(normalizeImmigrationStatus(42)).toBeNull();
    expect(normalizeImmigrationStatus({ status: "citizen" })).toBeNull();
    expect(normalizeImmigrationStatus(["citizen"])).toBeNull();
  });
});

describe("isProductTrack — whitelist", () => {
  it("accepts only the four product tracks", () => {
    expect(isProductTrack("aca")).toBe(true);
    expect(isProductTrack("private")).toBe(true);
    expect(isProductTrack("medicare")).toBe(true);
    expect(isProductTrack("medicaid_referral")).toBe(true);
    expect(isProductTrack("medicaid")).toBe(false);
    expect(isProductTrack("PRIVATE")).toBe(false);
    expect(isProductTrack("")).toBe(false);
    expect(isProductTrack(null)).toBe(false);
  });
});
