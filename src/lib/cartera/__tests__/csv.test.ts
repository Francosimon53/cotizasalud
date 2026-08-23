import { describe, it, expect } from "vitest";
import {
  parseCsv,
  normalizeHeader,
  suggestMapping,
  applyMapping,
  coerceNumber,
  coerceInt,
  coerceBoolean,
  coerceMetal,
  coerceDate,
} from "../csv";

describe("parseCsv (RFC-4180)", () => {
  it("parses simple rows with CRLF and skips blank lines", () => {
    const { headers, rows } = parseCsv("a,b,c\r\n1,2,3\r\n\r\n4,5,6\r\n");
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields with embedded commas, quotes and newlines", () => {
    const text = 'name,note\n"García, Ana","dijo ""hola""\nsegunda línea"\n';
    const { rows } = parseCsv(text);
    expect(rows[0][0]).toBe("García, Ana");
    expect(rows[0][1]).toBe('dijo "hola"\nsegunda línea');
  });

  it("strips a UTF-8 BOM from the first header", () => {
    const { headers } = parseCsv("\uFEFF" + "nombre,prima\nAna,300\n");
    expect(headers[0]).toBe("nombre");
  });
});

describe("normalizeHeader", () => {
  it("lowercases, strips accents and symbols", () => {
    expect(normalizeHeader(" Código Postal ")).toBe("codigo_postal");
    expect(normalizeHeader("Renovación Automática")).toBe("renovacion_automatica");
    expect(normalizeHeader("Date of Birth")).toBe("date_of_birth");
  });
});

describe("suggestMapping (encabezados mixtos ES/EN)", () => {
  it("maps a mixed Spanish/English header row", () => {
    const headers = [
      "Nombre",
      "DOB",
      "Ingreso Anual",
      "premium",
      "Subsidio",
      "Metal Level",
      "renovación automática",
      "Miembros Hogar",
      "notas internas",
    ];
    expect(suggestMapping(headers)).toEqual([
      "full_name",
      "date_of_birth",
      "estimated_annual_income",
      "monthly_premium",
      "monthly_subsidy",
      "metal_level",
      "auto_renewal",
      "household_members",
      null,
    ]);
  });

  it("does not map the same field twice", () => {
    const m = suggestMapping(["nombre", "name"]);
    expect(m).toEqual(["full_name", null]);
  });
});

describe("coercions", () => {
  it("numbers: strips $ and thousands separators", () => {
    expect(coerceNumber("$1,250.50")).toBe(1250.5);
    expect(coerceNumber(" 300 ")).toBe(300);
    expect(coerceNumber("abc")).toBeNull();
    expect(coerceNumber("")).toBeNull();
    expect(coerceInt("4.9")).toBe(4);
  });

  it("booleans: sí/yes/no in both languages", () => {
    expect(coerceBoolean("Sí")).toBe(true);
    expect(coerceBoolean("yes")).toBe(true);
    expect(coerceBoolean("NO")).toBe(false);
    expect(coerceBoolean("quizás")).toBeNull();
  });

  it("metal levels: Spanish and English names", () => {
    expect(coerceMetal("Bronce")).toBe("bronze");
    expect(coerceMetal("SILVER")).toBe("silver");
    expect(coerceMetal("Oro")).toBe("gold");
    expect(coerceMetal("copper")).toBeNull();
  });

  it("dates: ISO and slash formats", () => {
    expect(coerceDate("1968-07-04")).toBe("1968-07-04");
    expect(coerceDate("7/4/1968")).toBe("1968-07-04");
    expect(coerceDate("25/12/1970")).toBe("1970-12-25"); // day-first when unambiguous
    expect(coerceDate("13/13/1970")).toBeNull();
    expect(coerceDate("hace tiempo")).toBeNull();
  });
});

describe("applyMapping", () => {
  it("builds a field record and drops empty cells", () => {
    const mapping = suggestMapping(["nombre", "prima", "subsidio"]);
    expect(applyMapping(mapping, ["Ana García", "450", ""])).toEqual({
      full_name: "Ana García",
      monthly_premium: "450",
    });
  });
});
