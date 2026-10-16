import { describe, expect, it } from "vitest";

import {
  HEALTHSHERPA_SHOP_URL,
  buildHealthSherpaQuoteUrl,
  healthSherpaInputFromLead,
  type HealthSherpaQuoteInput,
} from "../healthsherpa-link";

const base: HealthSherpaQuoteInput = {
  agentId: "agente-prueba",
  zipCode: "33914",
  primaryAge: 40,
  primaryGender: "Female",
  householdIncome: 32000,
  householdSize: 3,
  leadId: "00000000-0000-4000-8000-000000000001",
  userType: "agent",
};

function params(url: string) {
  return new URL(url).searchParams;
}

describe("buildHealthSherpaQuoteUrl", () => {
  it("arma un GET a /public/shop del Mercado con los parámetros documentados", () => {
    const url = buildHealthSherpaQuoteUrl(base)!;
    expect(url.startsWith(`${HEALTHSHERPA_SHOP_URL}?`)).toBe(true);
    const p = params(url);
    expect(p.get("_agent_id")).toBe("agente-prueba");
    expect(p.get("zip_code")).toBe("33914");
    expect(p.get("people[primary][age]")).toBe("40");
    expect(p.get("people[primary][gender]")).toBe("female");
    expect(p.get("household_income")).toBe("32000");
    expect(p.get("household_size")).toBe("3");
    expect(p.get("user_type")).toBe("agent");
    expect(p.get("skip")).toBe("true");
    expect(p.get("off_ex")).toBe("false");
    expect(p.get("external_id")).toBe(base.leadId);
    expect(url).not.toContain("ichra");
  });

  it("user_type=consumer para el enlace del cliente", () => {
    const url = buildHealthSherpaQuoteUrl({ ...base, userType: "consumer" })!;
    expect(params(url).get("user_type")).toBe("consumer");
  });

  it("solo lleva los parámetros permitidos (nada de nombre, teléfono, correo ni fecha de nacimiento)", () => {
    const lead = {
      id: base.leadId,
      zipcode: "33914",
      ages: "40,12",
      genders: "Female,Male",
      annual_income: 32000,
      household_size: 3,
      contact_name: "Ana Prueba",
      contact_phone: "2395550000",
      contact_email: "ana@example.com",
      dob: "1986-02-03",
    };
    const url = buildHealthSherpaQuoteUrl(healthSherpaInputFromLead(lead, "agente-prueba", "agent"))!;
    expect([...params(url).keys()].sort()).toEqual(
      [
        "_agent_id",
        "external_id",
        "household_income",
        "household_size",
        "off_ex",
        "people[primary][age]",
        "people[primary][gender]",
        "skip",
        "user_type",
        "zip_code",
      ].sort()
    );
    for (const pii of ["Ana", "Prueba", "2395550000", "ana@example.com", "1986-02-03", "1986"]) {
      expect(decodeURIComponent(url)).not.toContain(pii);
    }
  });

  it.each([
    ["agentId", ""],
    ["zipCode", ""],
    ["zipCode", "339"],
    ["primaryAge", null],
    ["primaryGender", ""],
    ["primaryGender", "otro"],
    ["householdIncome", null],
    ["householdSize", 0],
    ["leadId", ""],
  ] as const)("devuelve null si falta o es inválido %s=%j (el botón no aparece)", (field, value) => {
    expect(buildHealthSherpaQuoteUrl({ ...base, [field]: value } as HealthSherpaQuoteInput)).toBeNull();
  });

  it("un ingreso de 0 es válido", () => {
    expect(buildHealthSherpaQuoteUrl({ ...base, householdIncome: 0 })).not.toBeNull();
  });
});
