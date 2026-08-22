// Excel (.xlsx) → the same cell matrix the CSV importer consumes.
//
// `read-excel-file` hands back typed cells — string | number | boolean |
// Date | null — not text. The shared mapping stage (`parseLeadCells`) only
// understands strings, so everything the sheet contains is flattened here,
// deterministically, before it reaches the pipeline the CSV path already
// uses. Pure functions: no DOM, no library import, testable with synthetic
// matrices that imitate the reader's output.
//
// The one real trap is dates. The reader builds each Date at 00:00 UTC of the
// calendar day the cell holds. Reading it back with the *local* getters
// (getFullYear/getMonth/getDate) in Florida (UTC-4/-5) yields the previous
// evening — i.e. the day before — and that date feeds nextRenewalDate(). So
// the UTC getters are the only correct way to recover the day that was typed.

/** Cell shapes `read-excel-file` can produce. Kept loose on purpose: the
 *  reader's own typings declare Date as `typeof Date`, and a defensive
 *  normaliser should not trust the exact union anyway. */
export type SheetCell = unknown;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DD" from UTC components. Invalid dates → "". */
export function formatSheetDate(d: Date): string {
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * number → string with every integer digit intact. `String(n)` already does
 * the right thing for anything a phone, zip or premium can be (it only
 * switches to exponent form at |n| ≥ 1e21 or |n| < 1e-6); the locale branch
 * is the safety net for those extremes so a digit string never leaves here
 * with an "e" in it.
 */
export function formatSheetNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const plain = String(n);
  if (!/e/i.test(plain)) return plain;
  return n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
}

/** One typed cell → the text the CSV path would have seen. */
export function normalizeSheetCell(value: SheetCell): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return formatSheetNumber(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return formatSheetDate(value);
  return String(value).trim();
}

const isBlankRow = (row: string[]) => row.every((c) => c === "");

/** True when at least one cell carries text — used to pick the sheet to read. */
export function sheetHasContent(cells: string[][]): boolean {
  return cells.some((row) => !isBlankRow(row));
}

/**
 * Sheet data (row 0 = headers) → string[][] ready for `parseLeadCells`.
 *
 * - Every cell goes through `normalizeSheetCell`.
 * - Short rows are padded to the header width so no column shifts left.
 * - Trailing blank rows are dropped: Excel happily reports formatted-but-empty
 *   rows below the data, and they would otherwise count toward the row limit
 *   and inflate "filas en blanco ignoradas". Blank rows *between* data rows
 *   are kept so `line` keeps matching the spreadsheet's own row numbers.
 */
export function sheetToCells(data: SheetCell[][]): string[][] {
  if (data.length === 0) return [];
  const width = data[0].length;
  const cells = data.map((row) => {
    const out = row.map(normalizeSheetCell);
    while (out.length < width) out.push("");
    return out;
  });
  let end = cells.length;
  while (end > 1 && isBlankRow(cells[end - 1])) end--;
  return cells.slice(0, end);
}
