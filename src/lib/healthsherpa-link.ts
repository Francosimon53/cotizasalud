// Enlace de cotización del Mercado pre-llenado en HealthSherpa ("one-click to
// pre-filled quote"):
// https://docs.healthsherpa.com/on-exchange-api-documentation/api-reference/deeplinking-to-plan-quoting/one-click-to-pre-filled-quote
//
// Es un GET a /public/shop con off_ex=false (Mercado, con subsidio). Reemplaza
// el POST anterior al flujo ICHRA de HealthSherpa, que cotiza fuera del
// Mercado. La URL nunca lleva nombre, teléfono, correo ni fecha de nacimiento:
// solo edad, género, ingreso y tamaño del hogar, más el id del lead como
// external_id.
//
// user_type: "agent" pide login del agente en HealthSherpa; "consumer" abre en
// modo consumidor y el cliente se inscribe él mismo, con el agente de
// _agent_id como agente de registro (confirmado en la documentación, 2026-10-16).

export const HEALTHSHERPA_SHOP_URL = "https://www.healthsherpa.com/public/shop";

// ID de agente de HealthSherpa (_agent_id): es el nombre de usuario que va
// después de "_agent_id=" en el enlace de marketing del agente (pestaña
// Marketing de su cuenta de HealthSherpa). NO es el NPN: con el NPN como
// _agent_id, HealthSherpa redirige a su portada y la cotización no se abre
// (probado el 2026-10-16).
const HEALTHSHERPA_AGENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

// Acepta el enlace de marketing completo (https://www.healthsherpa.com/?_agent_id=juan-perez)
// o el ID suelto. Devuelve null si no encuentra un ID válido.
export function parseHealthSherpaAgentId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  const pareceEnlace = /^https?:\/\//i.test(raw) || /healthsherpa\.com/i.test(raw) || raw.includes("?") || raw.includes("/");
  if (!pareceEnlace) return HEALTHSHERPA_AGENT_ID_RE.test(raw) ? raw : null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/(^|\.)healthsherpa\.com$/i.test(url.hostname)) return null;
  const id = (url.searchParams.get("_agent_id") || "").trim();
  return HEALTHSHERPA_AGENT_ID_RE.test(id) ? id : null;
}

// Valor guardado en agents.healthsherpa_agent_id → ID usable en el enlace.
// Un valor igual al NPN es el error conocido (se cargó el NPN donde va el
// usuario de HealthSherpa) y cuenta como vacío: así no se arma un enlace roto.
export function resolveHealthSherpaAgentId(stored: unknown, npn?: string | null): string | null {
  const id = parseHealthSherpaAgentId(stored);
  if (!id) return null;
  if (npn && id === String(npn).trim()) return null;
  return id;
}

export type HealthSherpaUserType = "agent" | "consumer";

export type HealthSherpaQuoteInput = {
  agentId: string | null | undefined;
  zipCode: string | null | undefined;
  primaryAge: number | string | null | undefined;
  primaryGender: string | null | undefined;
  householdIncome: number | string | null | undefined;
  householdSize: number | string | null | undefined;
  leadId: string | null | undefined;
  userType: HealthSherpaUserType;
};

function entero(v: unknown, min: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= min ? r : null;
}

function genero(v: unknown): "male" | "female" | null {
  if (typeof v !== "string") return null;
  const g = v.trim().toLowerCase();
  if (g === "male" || g === "m" || g === "masculino" || g === "hombre") return "male";
  if (g === "female" || g === "f" || g === "femenino" || g === "mujer") return "female";
  return null;
}

// Devuelve null si falta cualquier dato obligatorio: el botón no se muestra.
export function buildHealthSherpaQuoteUrl(input: HealthSherpaQuoteInput): string | null {
  const agentId = (input.agentId || "").trim();
  const zip = (input.zipCode || "").trim();
  const leadId = (input.leadId || "").trim();
  const age = entero(input.primaryAge, 0);
  const gender = genero(input.primaryGender);
  const income = entero(input.householdIncome, 0);
  const size = entero(input.householdSize, 1);

  if (!agentId || !/^\d{5}$/.test(zip) || !leadId || age === null || !gender || income === null || size === null) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("_agent_id", agentId);
  params.set("zip_code", zip);
  params.set("people[primary][age]", String(age));
  params.set("people[primary][gender]", gender);
  params.set("household_income", String(income));
  params.set("household_size", String(size));
  params.set("user_type", input.userType);
  params.set("skip", "true");
  params.set("off_ex", "false");
  params.set("external_id", leadId);
  return `${HEALTHSHERPA_SHOP_URL}?${params.toString()}`;
}

// Datos del lead → entrada del helper. Edad y género del principal salen del
// primer valor de leads.ages / leads.genders (listas separadas por coma).
export function healthSherpaInputFromLead(
  lead: Record<string, any>,
  agentId: string | null | undefined,
  userType: HealthSherpaUserType,
): HealthSherpaQuoteInput {
  const first = (csv: unknown) => (typeof csv === "string" ? csv.split(",")[0]?.trim() : undefined);
  return {
    agentId,
    zipCode: lead.zipcode,
    primaryAge: first(lead.ages),
    primaryGender: first(lead.genders),
    householdIncome: lead.annual_income,
    householdSize: lead.household_size,
    leadId: lead.id,
    userType,
  };
}
