// CSV parsing + flexible header mapping for the agent's client import.
//
// Pure functions shared by the client (preview + column report) and the
// server (row coercion before validation). RFC-4180: quoted fields, embedded
// commas/quotes/newlines, CRLF, BOM.
//
// This replaces the previous `line.split(",")` parser, which silently
// corrupted every row whose file contained a quoted comma — the single most
// common shape in a HealthSherpa export ("Lopez, Maria Jose").

export const LEAD_IMPORT_FIELDS = [
  "first_name",
  "last_name",
  "name",
  "phone",
  "email",
  "plan_name",
  "premium",
  "effective_date",
  "status",
  "zipcode",
] as const;

export type LeadImportField = (typeof LEAD_IMPORT_FIELDS)[number];

export const FIELD_LABELS_ES: Record<LeadImportField, string> = {
  first_name: "Nombre",
  last_name: "Apellido",
  name: "Nombre completo",
  phone: "Teléfono",
  email: "Correo",
  plan_name: "Plan",
  premium: "Prima mensual",
  effective_date: "Fecha efectiva",
  status: "Estado",
  zipcode: "Código postal",
};

// Fields without which a row cannot become a lead.
export const REQUIRED_FIELDS: LeadImportField[] = ["phone"];

const HEADER_ALIASES: Record<LeadImportField, string[]> = {
  first_name: ["first_name", "firstname", "first", "primer_nombre", "nombre_pila", "given_name"],
  last_name: ["last_name", "lastname", "last", "apellido", "apellidos", "surname", "family_name"],
  name: [
    "name", "full_name", "fullname", "nombre", "nombre_completo", "cliente", "client",
    "client_name", "nombre_cliente", "member_name", "applicant_name", "consumer_name",
    "asegurado", "titular", "primary_applicant", "subscriber_name", "contact_name",
  ],
  phone: [
    "phone", "phone_number", "phonenumber", "telefono", "telefono_celular", "celular",
    "movil", "tel", "mobile", "cell", "cell_phone", "contact_phone", "primary_phone",
    "home_phone", "numero", "numero_telefono",
  ],
  email: ["email", "email_address", "emailaddress", "correo", "correo_electronico", "e_mail", "mail"],
  plan_name: [
    "plan", "plan_name", "planname", "nombre_del_plan", "nombre_plan", "plan_seleccionado",
    "product_name", "product", "producto", "plan_marketing_name", "qhp_name",
  ],
  premium: [
    "premium", "monthly_premium", "prima", "prima_mensual", "premium_monthly", "prima_neta",
    "net_premium", "premium_after_aptc", "premium_amount", "monto_prima", "costo_mensual",
  ],
  effective_date: [
    "effective_date", "effectivedate", "start_date", "coverage_start", "coverage_start_date",
    "fecha_efectiva", "fecha_de_inicio", "fecha_inicio", "policy_effective_date",
    "enrollment_date", "fecha_inscripcion", "fecha_de_vigencia", "vigencia",
  ],
  status: [
    "status", "enrollment_status", "policy_status", "estado", "estatus",
    "estado_de_inscripcion", "estado_inscripcion", "application_status", "member_status",
  ],
  zipcode: ["zip", "zip_code", "zipcode", "postal_code", "codigo_postal", "cp", "codigo"],
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

/** index de columna del CSV → campo sugerido (null = columna ignorada). */
export function suggestMapping(headers: string[]): (LeadImportField | null)[] {
  const used = new Set<LeadImportField>();
  return headers.map((h) => {
    const norm = normalizeHeader(h);
    if (!norm) return null;
    for (const field of LEAD_IMPORT_FIELDS) {
      if (used.has(field)) continue;
      if (HEADER_ALIASES[field].includes(norm)) {
        used.add(field);
        return field;
      }
    }
    return null;
  });
}

/** RFC-4180 parser. Handles quoted commas, escaped quotes, CRLF and BOM. */
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
    // Drop records that are entirely empty (trailing newline, blank lines).
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

export interface ParsedLeadRow {
  /** 1-based line number in the file (header is line 1) — for error messages. */
  line: number;
  name: string;
  phone: string;
  email: string;
  planName: string;
  premium: string;
  effectiveDate: string;
  status: string;
  zipcode: string;
}

export interface ParsedFile {
  headers: string[];
  mapping: (LeadImportField | null)[];
  /** Fields the file has a column for. */
  mappedFields: LeadImportField[];
  /** Fields with no matching column — surfaced to the agent, not swallowed. */
  missingFields: LeadImportField[];
  /** Column headers the importer ignored. */
  ignoredHeaders: string[];
  rows: ParsedLeadRow[];
  /** Rows dropped because they had neither a name nor a phone. */
  droppedRows: number;
}

/** Digits only, and strip a leading US country code so dedupe is stable. */
export function normalizePhone(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/**
 * Shared stage: matrix of cells (row 0 = headers) → mapped rows.
 *
 * Both file formats end here: the CSV parser hands over the text split into
 * cells, the Excel reader hands over the normalized sheet. Everything that
 * decides what a row *means* (header aliases, name assembly, dropped rows,
 * missing fields) lives here and only here, so the two paths cannot drift.
 */
export function parseLeadCells(cells: string[][]): ParsedFile {
  const [headers = [], ...rows] = cells;
  const mapping = suggestMapping(headers);

  const col = (field: LeadImportField): number => mapping.indexOf(field);
  const at = (row: string[], field: LeadImportField): string => {
    const i = col(field);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  const mappedFields = LEAD_IMPORT_FIELDS.filter((f) => mapping.includes(f));
  const ignoredHeaders = headers.filter((h, i) => mapping[i] === null && h.trim() !== "");

  const parsed: ParsedLeadRow[] = [];
  let droppedRows = 0;

  rows.forEach((row, i) => {
    const first = at(row, "first_name");
    const last = at(row, "last_name");
    const combined = `${first} ${last}`.trim();
    const name = combined || at(row, "name");
    const phone = at(row, "phone");

    // A row with neither a name nor a phone is a spacer, not a client.
    if (!name && !phone) {
      droppedRows++;
      return;
    }

    parsed.push({
      line: i + 2, // +1 for 0-index, +1 for the header row
      name,
      phone,
      email: at(row, "email"),
      planName: at(row, "plan_name"),
      premium: at(row, "premium"),
      effectiveDate: at(row, "effective_date"),
      status: at(row, "status"),
      zipcode: at(row, "zipcode"),
    });
  });

  // "name" counts as present when first+last are there instead.
  const nameCovered = mapping.includes("name") || (mapping.includes("first_name") && mapping.includes("last_name"));
  const missingFields = LEAD_IMPORT_FIELDS.filter((f) => {
    if (f === "first_name" || f === "last_name") return false;
    if (f === "name") return !nameCovered;
    return !mapping.includes(f);
  });

  return { headers, mapping, mappedFields, missingFields, ignoredHeaders, rows: parsed, droppedRows };
}

/** CSV text → parsed file. Text parsing on top, shared mapping underneath. */
export function parseLeadFile(text: string): ParsedFile {
  const { headers, rows } = parseCsv(text);
  return parseLeadCells([headers, ...rows]);
}
