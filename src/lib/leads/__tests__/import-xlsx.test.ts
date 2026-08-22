import { describe, it, expect } from "vitest";
import {
  formatSheetDate,
  formatSheetNumber,
  normalizeSheetCell,
  sheetHasContent,
  sheetToCells,
} from "../import-xlsx";
import { parseLeadCells, parseLeadFile } from "../import-csv";

// Matrices below imitate what `read-excel-file` returns for a sheet: typed
// cells (string | number | boolean | Date | null), row 0 = headers. No binary
// fixtures in the repo — the reader is a dependency, the normaliser is ours.

const HEADERS = ["First Name", "Last Name", "Phone", "Email", "Plan Name", "Monthly Premium", "Effective Date", "Status", "Zip"];

describe("normalizeSheetCell", () => {
  it("turns null/undefined into an empty cell", () => {
    expect(normalizeSheetCell(null)).toBe("");
    expect(normalizeSheetCell(undefined)).toBe("");
  });

  it("keeps every digit of a phone stored as a number — no scientific notation", () => {
    expect(normalizeSheetCell(3055551234)).toBe("3055551234");
    expect(formatSheetNumber(13055551234)).toBe("13055551234");
    // Beyond the point where String() would switch to exponent form.
    expect(formatSheetNumber(1e21)).toBe("1000000000000000000000");
    expect(formatSheetNumber(1e21)).not.toMatch(/e/i);
    expect(formatSheetNumber(1e-7)).toBe("0.0000001");
  });

  it("keeps decimals for a premium stored as a number", () => {
    expect(normalizeSheetCell(1234.56)).toBe("1234.56");
    expect(normalizeSheetCell(116.24)).toBe("116.24");
    expect(normalizeSheetCell(0)).toBe("0");
  });

  it("drops NaN/Infinity instead of leaking them as text", () => {
    expect(normalizeSheetCell(Number.NaN)).toBe("");
    expect(normalizeSheetCell(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("formats Date as YYYY-MM-DD from UTC components", () => {
    // The reader builds dates at 00:00 UTC. Local getters in Florida would
    // read this as 2025-12-31 19:00 and shift the date back a day.
    expect(normalizeSheetCell(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
    expect(formatSheetDate(new Date(Date.UTC(2025, 11, 31)))).toBe("2025-12-31");
    expect(formatSheetDate(new Date(Date.UTC(2026, 2, 5)))).toBe("2026-03-05");
  });

  it("turns an invalid Date into an empty cell", () => {
    expect(normalizeSheetCell(new Date("not a date"))).toBe("");
  });

  it("maps booleans to true/false and trims strings", () => {
    expect(normalizeSheetCell(true)).toBe("true");
    expect(normalizeSheetCell(false)).toBe("false");
    expect(normalizeSheetCell("  Ambetter Silver  ")).toBe("Ambetter Silver");
  });
});

describe("sheetToCells", () => {
  it("pads short rows to the header width so columns do not shift", () => {
    const cells = sheetToCells([
      ["Nombre", "Teléfono", "Estado"],
      ["Ana", 2395551234], // Excel omits trailing empty cells
    ]);
    expect(cells[1]).toEqual(["Ana", "2395551234", ""]);
    const parsed = parseLeadCells(cells);
    expect(parsed.rows[0].phone).toBe("2395551234");
    expect(parsed.rows[0].status).toBe("");
  });

  it("keeps null cells in place so the columns after them still map", () => {
    const cells = sheetToCells([
      ["Nombre", "Correo", "Teléfono"],
      ["Ana", null, 2395551234],
    ]);
    expect(cells[1]).toEqual(["Ana", "", "2395551234"]);
    const parsed = parseLeadCells(cells);
    expect(parsed.rows[0].email).toBe("");
    expect(parsed.rows[0].phone).toBe("2395551234");
  });

  it("drops trailing blank rows but keeps interior ones (line numbers stay real)", () => {
    const cells = sheetToCells([
      ["Nombre", "Teléfono"],
      ["Ana", 2395551234],
      [null, null],
      ["Luis", 2395559999],
      [null, null],
      [null, null],
    ]);
    expect(cells).toHaveLength(4);
    const parsed = parseLeadCells(cells);
    expect(parsed.rows.map((r) => r.line)).toEqual([2, 4]);
    expect(parsed.droppedRows).toBe(1);
  });

  it("returns an empty matrix for an empty sheet", () => {
    expect(sheetToCells([])).toEqual([]);
    expect(sheetHasContent(sheetToCells([]))).toBe(false);
    expect(sheetHasContent(sheetToCells([[null, null]]))).toBe(false);
    expect(sheetHasContent(sheetToCells([["Nombre"]]))).toBe(true);
  });
});

describe("Excel path through parseLeadCells", () => {
  it("carries a numeric phone into ParsedLeadRow as a 10-digit string", () => {
    const parsed = parseLeadCells(sheetToCells([HEADERS, ["Maria", "Lopez", 3055551234, null, null, null, null, null, null]]));
    expect(parsed.rows[0].phone).toBe("3055551234");
  });

  it("carries a formatted phone string exactly like the CSV path", () => {
    const excel = parseLeadCells(sheetToCells([["Nombre", "Teléfono"], ["Ana", "(305) 555-1234"]]));
    const csv = parseLeadFile('Nombre,Teléfono\nAna,"(305) 555-1234"\n');
    expect(excel.rows[0].phone).toBe("(305) 555-1234");
    expect(excel.rows).toEqual(csv.rows);
  });

  it("carries a numeric premium and a Date into the row as text", () => {
    const parsed = parseLeadCells(
      sheetToCells([HEADERS, ["Luis", "Perez", 2395559999, "", "Oscar Gold", 1234.56, new Date("2026-01-01T00:00:00.000Z"), "Active", 34120]])
    );
    expect(parsed.rows[0].premium).toBe("1234.56");
    expect(parsed.rows[0].effectiveDate).toBe("2026-01-01");
    expect(parsed.rows[0].zipcode).toBe("34120");
  });

  it("PARITY: the same book as CSV text and as an Excel matrix yields identical rows", () => {
    const csv = [
      "First Name,Last Name,Phone,Email,Plan Name,Monthly Premium,Effective Date,Status,Zip,Agent Notes",
      'Maria,"Lopez, Jose",(239) 555-1234,maria@example.com,Ambetter Clarity Silver,116.24,2026-01-01,Active,34142,ignorar',
      "Luis,Perez,2395559999,,Oscar Gold Simple,0,2026-03-01,Active,34120,",
      ",,,,,,,,,",
      "Ana,,3055551234,ana@example.com,,,,Inactive,33101,",
      "",
    ].join("\n");

    const excel = [
      ["First Name", "Last Name", "Phone", "Email", "Plan Name", "Monthly Premium", "Effective Date", "Status", "Zip", "Agent Notes"],
      ["Maria", "Lopez, Jose", "(239) 555-1234", "maria@example.com", "Ambetter Clarity Silver", 116.24, new Date("2026-01-01T00:00:00.000Z"), "Active", 34142, "ignorar"],
      ["Luis", "Perez", 2395559999, null, "Oscar Gold Simple", 0, new Date("2026-03-01T00:00:00.000Z"), "Active", 34120, null],
      [null, null, null, null, null, null, null, null, null, null],
      ["Ana", null, 3055551234, "ana@example.com", null, null, null, "Inactive", 33101],
      [null, null, null, null, null, null, null, null, null, null],
    ];

    const fromCsv = parseLeadFile(csv);
    const fromExcel = parseLeadCells(sheetToCells(excel));

    expect(fromExcel.rows).toEqual(fromCsv.rows);
    expect(fromExcel.mappedFields).toEqual(fromCsv.mappedFields);
    expect(fromExcel.missingFields).toEqual(fromCsv.missingFields);
    expect(fromExcel.ignoredHeaders).toEqual(fromCsv.ignoredHeaders);
    expect(fromExcel.droppedRows).toEqual(fromCsv.droppedRows);
    expect(fromExcel.rows).toHaveLength(3);
  });
});
