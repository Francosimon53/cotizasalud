// CSV parsing + flexible header mapping for the portfolio import (Fase A).
// Pure functions shared by the client (preview + mapping screen) and the
// server (per-row coercion before validation). RFC-4180: quoted fields,
// embedded commas/quotes/newlines, CRLF. The legacy parser in
// agentes/dashboard/import/ImportClient.tsx splits on raw commas — do not
// reuse it here.

export const PORTFOLIO_FIELDS = [
  "full_name",
  "date_of_birth",
  "estimated_age",
  "zip_code",
  "county",
  "household_members",
  "estimated_annual_income",
  "current_carrier",
  "metal_level",
  "monthly_premium",
  "monthly_subsidy",
  "auto_renewal",
  "phone",
  "email",
] as const;

export type PortfolioField = (typeof PORTFOLIO_FIELDS)[number];

// Etiquetas en español para la pantalla de mapeo de columnas.
export const FIELD_LABELS_ES: Record<PortfolioField, string> = {
  full_name: "Nombre completo",
  date_of_birth: "Fecha de nacimiento",
  estimated_age: "Edad",
  zip_code: "Código postal",
  county: "Condado",
  household_members: "Miembros del hogar",
  estimated_annual_income: "Ingreso anual estimado",
  current_carrier: "Aseguradora actual",
  metal_level: "Nivel de metal",
  monthly_premium: "Prima mensual",
  monthly_subsidy: "Subsidio mensual",
  auto_renewal: "Renovación automática",
  phone: "Teléfono",
  email: "Email",
};

const HEADER_ALIASES: Record<PortfolioField, string[]> = {
  full_name: ["nombre", "name", "full_name", "nombre_completo", "cliente", "client", "client_name", "nombre_cliente", "member_name", "asegurado"],
  date_of_birth: ["dob", "fecha_nacimiento", "fecha_de_nacimiento", "birth_date", "birthdate", "date_of_birth", "nacimiento"],
  estimated_age: ["edad", "age", "estimated_age", "edad_estimada"],
  zip_code: ["zip", "zip_code", "zipcode", "codigo_postal", "cp", "postal_code"],
  county: ["condado", "county"],
  household_members: ["miembros_hogar", "miembros", "household", "household_size", "household_members", "tamano_hogar", "tamano_del_hogar", "personas", "familia"],
  estimated_annual_income: ["income", "ingreso", "ingresos", "ingreso_anual", "annual_income", "ingreso_anual_estimado", "estimated_income", "household_income", "magi"],
  current_carrier: ["aseguradora", "carrier", "aseguradora_actual", "insurance_company", "insurer", "compania", "current_carrier"],
  metal_level: ["metal", "nivel_metal", "metal_level", "plan_metal", "nivel_de_metal"],
  monthly_premium: ["prima", "premium", "prima_mensual", "monthly_premium", "premium_monthly", "prima_neta", "net_premium"],
  monthly_subsidy: ["subsidio", "subsidy", "aptc", "subsidio_mensual", "monthly_subsidy", "tax_credit", "credito_fiscal"],
  auto_renewal: ["renovacion_automatica", "auto_renewal", "auto_renew", "autorenovacion", "renovacion_auto", "auto_reenrollment"],
  phone: ["telefono", "phone", "phone_number", "celular", "movil", "tel"],
  email: ["email", "correo", "correo_electronico", "e_mail", "mail"],
};

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// index de columna → campo sugerido (null = sin mapear, el agente decide).
export function suggestMapping(headers: string[]): (PortfolioField | null)[] {
  const used = new Set<PortfolioField>();
  return headers.map((h) => {
    const norm = normalizeHeader(h);
    if (!norm) return null;
    for (const field of PORTFOLIO_FIELDS) {
      if (used.has(field)) continue;
      if (HEADER_ALIASES[field].includes(norm)) {
        used.add(field);
        return field;
      }
    }
    return null;
  });
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const clean = text.replace(/^\uFEFF/, "");

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    // Skip records that are entirely empty (trailing newline, blank lines)
    if (record.length > 1 || record[0].trim() !== "") records.push(record);
    record = [];
  };

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n") {
      endRecord();
    } else if (c === "\r") {
      if (clean[i + 1] === "\n") i++;
      endRecord();
    } else {
      field += c;
    }
  }
  if (field !== "" || record.length > 0) endRecord();

  const [headers = [], ...rows] = records;
  return { headers, rows };
}

// ---- Value coercion (used server-side before Zod validation, and in the ----
// ---- client preview). All return null on unparseable input.             ----

export function coerceNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[$\s,]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function coerceInt(raw: string | null | undefined): number | null {
  const n = coerceNumber(raw);
  return n == null ? null : Math.floor(n);
}

const TRUE_WORDS = new Set(["si", "sí", "yes", "true", "1", "y", "s"]);
const FALSE_WORDS = new Set(["no", "false", "0", "n"]);

export function coerceBoolean(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (TRUE_WORDS.has(v)) return true;
  if (FALSE_WORDS.has(v)) return false;
  return null;
}

const METAL_MAP: Record<string, "bronze" | "silver" | "gold" | "platinum"> = {
  bronze: "bronze",
  bronce: "bronze",
  silver: "silver",
  plata: "silver",
  gold: "gold",
  oro: "gold",
  platinum: "platinum",
  platino: "platinum",
};

export function coerceMetal(
  raw: string | null | undefined
): "bronze" | "silver" | "gold" | "platinum" | null {
  if (raw == null) return null;
  return METAL_MAP[raw.trim().toLowerCase()] ?? null;
}

// Accepts YYYY-MM-DD and M/D/YYYY (US). If the first slash-number is > 12 it
// is read as D/M/YYYY. Returns ISO date string or null.
export function coerceDate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = raw.trim();
  if (v === "") return null;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  let year: number, month: number, day: number;
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    year = Number(slash[3]);
    if (a > 12) [a, b] = [b, a];
    [month, day] = [a, b];
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Applies a column mapping to a raw CSV row → { field: rawString }.
export function applyMapping(
  mapping: (PortfolioField | null)[],
  row: string[]
): Partial<Record<PortfolioField, string>> {
  const out: Partial<Record<PortfolioField, string>> = {};
  mapping.forEach((field, i) => {
    if (!field) return;
    const value = (row[i] ?? "").trim();
    if (value !== "") out[field] = value;
  });
  return out;
}
