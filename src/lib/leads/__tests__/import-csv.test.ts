import { describe, expect, it } from "vitest";
import {
  normalizeHeader,
  normalizePhone,
  parseCsv,
  parseLeadFile,
  suggestMapping,
} from "../import-csv";

describe("parseCsv — RFC-4180", () => {
  it("keeps commas that live inside quoted fields", () => {
    // The exact shape that corrupted every HealthSherpa export under the old
    // `line.split(",")` parser.
    const { headers, rows } = parseCsv('name,phone\n"Lopez, Maria Jose",2395551234\n');
    expect(headers).toEqual(["name", "phone"]);
    expect(rows).toEqual([["Lopez, Maria Jose", "2395551234"]]);
  });

  it("unescapes doubled quotes", () => {
    const { rows } = parseCsv('name\n"Ana ""La Flaca"" Ruiz"\n');
    expect(rows[0][0]).toBe('Ana "La Flaca" Ruiz');
  });

  it("keeps newlines inside quoted fields", () => {
    const { rows } = parseCsv('name,notes\nAna,"linea 1\nlinea 2"\n');
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("linea 1\nlinea 2");
  });

  it("handles CRLF and a UTF-8 BOM", () => {
    const { headers, rows } = parseCsv('﻿name,phone\r\nAna,2395551234\r\n');
    expect(headers).toEqual(["name", "phone"]);
    expect(rows).toEqual([["Ana", "2395551234"]]);
  });

  it("drops blank lines instead of emitting empty records", () => {
    const { rows } = parseCsv("name,phone\nAna,2395551234\n\n\nLuis,2395559999\n");
    expect(rows).toHaveLength(2);
  });
});

describe("normalizeHeader", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeHeader("  Teléfono Celular ")).toBe("telefono_celular");
    expect(normalizeHeader("Effective Date")).toBe("effective_date");
    expect(normalizeHeader("Código Postal")).toBe("codigo_postal");
  });
});

describe("suggestMapping", () => {
  it("maps English HealthSherpa-style headers", () => {
    const m = suggestMapping(["First Name", "Last Name", "Phone", "Email", "Plan Name", "Monthly Premium", "Effective Date", "Status", "Zip"]);
    expect(m).toEqual(["first_name", "last_name", "phone", "email", "plan_name", "premium", "effective_date", "status", "zipcode"]);
  });

  it("maps Spanish headers", () => {
    const m = suggestMapping(["Nombre completo", "Teléfono", "Correo", "Prima mensual", "Fecha efectiva", "Estado"]);
    expect(m).toEqual(["name", "phone", "email", "premium", "effective_date", "status"]);
  });

  it("returns null for columns it does not recognize", () => {
    expect(suggestMapping(["Phone", "Agent Commission"])).toEqual(["phone", null]);
  });

  it("does not assign the same field to two columns", () => {
    const m = suggestMapping(["Phone", "Mobile"]);
    expect(m.filter((f) => f === "phone")).toHaveLength(1);
  });
});

describe("normalizePhone", () => {
  it("keeps digits only", () => {
    expect(normalizePhone("(239) 555-1234")).toBe("2395551234");
  });

  it("strips a leading US country code so dedupe is stable", () => {
    expect(normalizePhone("+1 239 555 1234")).toBe("2395551234");
    expect(normalizePhone("12395551234")).toBe("2395551234");
  });

  it("survives empty and null-ish input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(undefined as unknown as string)).toBe("");
  });
});

describe("parseLeadFile", () => {
  const file = [
    "First Name,Last Name,Phone,Email,Plan Name,Monthly Premium,Effective Date,Status,Zip,Agent Notes",
    'Maria,"Lopez, Jose",(239) 555-1234,maria@example.com,Ambetter Clarity Silver,$116.24,01/01/2026,Active,34142,ignorar',
    "Luis,Perez,2395559999,,Oscar Gold Simple,0,2026-03-01,Active,34120,",
    "",
  ].join("\n");

  it("combines first and last name and reports the real line number", () => {
    const parsed = parseLeadFile(file);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].name).toBe("Maria Lopez, Jose");
    expect(parsed.rows[0].line).toBe(2);
    expect(parsed.rows[1].line).toBe(3);
  });

  it("reports which fields mapped and which columns were ignored", () => {
    const parsed = parseLeadFile(file);
    expect(parsed.missingFields).toEqual([]);
    expect(parsed.ignoredHeaders).toEqual(["Agent Notes"]);
  });

  it("names the missing fields instead of importing them silently", () => {
    const parsed = parseLeadFile("Nombre,Teléfono\nAna,2395551234\n");
    expect(parsed.missingFields).toContain("status");
    expect(parsed.missingFields).toContain("effective_date");
    expect(parsed.missingFields).not.toContain("name");
  });

  it("drops rows with neither name nor phone and counts them", () => {
    const parsed = parseLeadFile("Nombre,Teléfono\nAna,2395551234\n,\n");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.droppedRows).toBe(1);
  });

  it("returns no rows for a file that is not a CSV at all", () => {
    expect(parseLeadFile("").rows).toHaveLength(0);
  });
});
