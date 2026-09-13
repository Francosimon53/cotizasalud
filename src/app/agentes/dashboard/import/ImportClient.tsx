"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FIELD_LABELS_ES,
  parseLeadCells,
  parseLeadFile,
  type LeadImportField,
  type ParsedFile,
  type ParsedLeadRow,
} from "@/lib/leads/import-csv";
import { sheetHasContent, sheetToCells } from "@/lib/leads/import-xlsx";

const BATCH_SIZE = 500; // must stay <= MAX_ROWS in /api/leads/import

// Guardrails for the Excel path. They protect the agent's browser — an .xlsx
// is a zip that inflates several times over when parsed — not the server,
// which keeps its own limits per request.
const MAX_XLSX_BYTES = 10 * 1024 * 1024;
const MAX_XLSX_DATA_ROWS = 5000;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ACCEPTED_FILES = `.csv,text/csv,.txt,.xlsx,${XLSX_MIME}`;

const NO_ROWS_MESSAGE =
  "No se encontró ningún cliente en el archivo. Revisa que la primera fila sean los encabezados de columna y que haya una columna de teléfono.";

interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  missingEffectiveDate: number;
}

interface FileReport {
  rows: ParsedLeadRow[];
  mappedFields: LeadImportField[];
  missingFields: LeadImportField[];
  ignoredHeaders: string[];
  droppedRows: number;
  /** Set only when an Excel book had several sheets with content: which one
   *  was read, so the agent is never left guessing. */
  sheetNote: string | null;
}

const REASON_LABELS: Record<string, string> = {
  duplicate: "Ya estaba en tu cartera",
  duplicate_in_file: "Repetido dentro del archivo",
  missing_name: "Sin nombre",
  missing_phone: "Sin teléfono",
  invalid_phone: "Teléfono incompleto",
};

export default function ImportClient({ agentSlug }: { agentSlug: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<FileReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportSummary | null>(null);
  const [problems, setProblems] = useState<{ line: number; reason: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const showParsed = (parsed: ParsedFile, sheetNote: string | null) => {
    if (parsed.rows.length === 0) {
      setReport(null);
      setError(NO_ROWS_MESSAGE);
      return;
    }
    setReport({
      rows: parsed.rows,
      mappedFields: parsed.mappedFields,
      missingFields: parsed.missingFields,
      ignoredHeaders: parsed.ignoredHeaders,
      droppedRows: parsed.droppedRows,
      sheetNote,
    });
  };

  const readCsv = (file: File) => {
    const reader = new FileReader();
    reader.onerror = () => setError("No se pudo leer el archivo. Intenta de nuevo.");
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      showParsed(parseLeadFile(text ?? ""), null);
    };
    reader.readAsText(file, "UTF-8");
  };

  // The .xlsx is parsed entirely in the browser; the binary never leaves the
  // agent's machine. Only the same JSON rows the CSV path produces are sent.
  const readXlsx = async (file: File) => {
    if (file.size > MAX_XLSX_BYTES) {
      setError(
        `"${file.name}" pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo para Excel es 10 MB. Divide la cartera en varios archivos o guárdala como CSV.`
      );
      return;
    }

    let sheets: { sheet: string; cells: string[][] }[];
    try {
      // Loaded on demand: agents who upload CSV never download the reader.
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const book = await readXlsxFile(file);
      sheets = book
        .map((s) => ({ sheet: s.sheet, cells: sheetToCells(s.data) }))
        .filter((s) => sheetHasContent(s.cells));
    } catch {
      setError(
        `No se pudo leer "${file.name}". Si el archivo está protegido con contraseña, quítasela; si no, ábrelo en Excel y usa Archivo → Guardar como → Libro de Excel (.xlsx) o CSV UTF-8, y vuelve a subirlo.`
      );
      return;
    }

    if (sheets.length === 0) {
      setError(NO_ROWS_MESSAGE);
      return;
    }

    const chosen = sheets[0];
    const dataRows = chosen.cells.length - 1; // minus the header row
    if (dataRows > MAX_XLSX_DATA_ROWS) {
      setError(
        `La hoja "${chosen.sheet}" tiene ${dataRows.toLocaleString("es")} filas y el máximo por archivo es ${MAX_XLSX_DATA_ROWS.toLocaleString("es")}. Divide la cartera en varios archivos y súbelos uno por uno.`
      );
      return;
    }

    const sheetNote =
      sheets.length > 1
        ? `Se leyó la hoja "${chosen.sheet}". El libro tiene ${sheets.length} hojas con datos; las demás (${sheets.slice(1).map((s) => `"${s.sheet}"`).join(", ")}) no se importan.`
        : null;

    showParsed(parseLeadCells(chosen.cells), sheetNote);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResults(null);
    setProblems([]);
    setError(null);
    setReport(null);
    setFileName(file.name);

    // Legacy binary Excel, Numbers and OpenDocument are not readable here.
    if (/\.(xls|numbers|ods)$/i.test(file.name)) {
      setError(
        `"${file.name}" está en un formato que no podemos leer. Ábrelo y usa Archivo → Guardar como → Libro de Excel (.xlsx) o CSV UTF-8, y sube ese archivo.`
      );
      return;
    }

    if (/\.xlsx$/i.test(file.name)) {
      void readXlsx(file);
      return;
    }

    readCsv(file);
  };

  const handleImport = async () => {
    if (!report) return;
    setImporting(true);
    setError(null);
    setProgress(0);

    const totals: ImportSummary = {
      total: 0, imported: 0, skipped: 0, errors: 0, missingEffectiveDate: 0,
    };
    const allProblems: { line: number; reason: string }[] = [];

    try {
      for (let i = 0; i < report.rows.length; i += BATCH_SIZE) {
        const chunk = report.rows.slice(i, i + BATCH_SIZE);
        const res = await fetch("/api/leads/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk, agentSlug }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // Surface the real reason instead of counting it as a silent error.
          setError(
            data?.message ||
              (res.status === 429
                ? "Alcanzaste el límite de importaciones por hora. Espera un momento y vuelve a intentar."
                : res.status === 401 || res.status === 403
                  ? "Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo."
                  : `El servidor respondió ${res.status}. No se importó este bloque.`)
          );
          break;
        }

        totals.total += data.total ?? chunk.length;
        totals.imported += data.imported ?? 0;
        totals.skipped += data.skipped ?? 0;
        totals.errors += data.errors ?? 0;
        totals.missingEffectiveDate += data.missingEffectiveDate ?? 0;
        if (Array.isArray(data.details)) allProblems.push(...data.details);

        setProgress(Math.min(i + chunk.length, report.rows.length));
      }
    } catch {
      setError("Se perdió la conexión durante la importación. Los clientes que alcanzaron a entrar están guardados; puedes volver a subir el mismo archivo y los repetidos se omiten solos.");
    }

    setResults(totals);
    setProblems(allProblems.slice(0, 50));
    setImporting(false);
  };

  const cardStyle: React.CSSProperties = {
    background: "#12141c", borderRadius: 16, padding: 24,
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20,
  };
  const thStyle: React.CSSProperties = {
    padding: "6px 8px", color: "#5a5e72", fontWeight: 700, textAlign: "left",
    borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, textTransform: "uppercase",
  };
  const tdStyle: React.CSSProperties = { padding: "6px 8px", color: "#8b8fa3", fontSize: 16 };

  const pct = report && report.rows.length > 0
    ? Math.round((progress / report.rows.length) * 100)
    : 0;

  return (
    // ph-no-capture: session replay must never record lead data.
    <div className="ph-no-capture">
      <button onClick={() => router.push("/agentes/dashboard")} style={{ padding: "6px 14px", borderRadius: 8, marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Dashboard</button>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Importar Clientes</h1>
      <p style={{ fontSize: 14, color: "#5a5e72", marginBottom: 24 }}>Sube un CSV o un Excel (.xlsx) exportado de HealthSherpa para importar tus clientes. Puedes subir tu cartera completa de una vez.</p>

      <div style={cardStyle}>
        <input ref={fileRef} type="file" accept={ACCEPTED_FILES} onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} disabled={importing} style={{ width: "100%", padding: "20px", borderRadius: 10, border: "2px dashed rgba(255,255,255,0.15)", background: "transparent", color: "#8b8fa3", fontSize: 16, fontWeight: 700, cursor: importing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          📄 {fileName || "Seleccionar archivo CSV o Excel"}
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#ef4444", marginBottom: 6 }}>No se pudo continuar</div>
          <div style={{ fontSize: 14, color: "#f0f1f5", lineHeight: 1.5 }}>{error}</div>
        </div>
      )}

      {report && (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Columnas detectadas</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: report.missingFields.length ? 14 : 0 }}>
              {report.mappedFields
                .filter((f) => f !== "first_name" && f !== "last_name")
                .map((f) => (
                  <span key={f} style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                    ✓ {FIELD_LABELS_ES[f]}
                  </span>
                ))}
            </div>
            {report.missingFields.length > 0 && (
              <div style={{ fontSize: 13, color: "#f59e0b", lineHeight: 1.5 }}>
                Sin columna en tu archivo: {report.missingFields.map((f) => FIELD_LABELS_ES[f]).join(", ")}. Esos campos entrarán vacíos.
              </div>
            )}
            {report.droppedRows > 0 && (
              <div style={{ fontSize: 13, color: "#5a5e72", marginTop: 8 }}>
                {report.droppedRows} fila(s) en blanco ignoradas.
              </div>
            )}
            {report.sheetNote && (
              <div style={{ fontSize: 13, color: "#8b8fa3", marginTop: 8, lineHeight: 1.5 }}>
                {report.sheetNote}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Vista Previa ({report.rows.length} registros)</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>{["Nombre", "Teléfono", "Email", "Plan", "Prima", "Fecha", "Estado"].map((h) => (<th key={h} style={thStyle}>{h}</th>))}</tr>
                </thead>
                <tbody>
                  {report.rows.slice(0, 10).map((r) => (
                    <tr key={r.line}>
                      <td style={{ ...tdStyle, color: "#f0f1f5", fontWeight: 600 }}>{r.name}</td>
                      <td style={tdStyle}>{r.phone}</td>
                      <td style={tdStyle}>{r.email}</td>
                      <td style={tdStyle}>{r.planName}</td>
                      <td style={tdStyle}>{r.premium}</td>
                      <td style={tdStyle}>{r.effectiveDate}</td>
                      <td style={tdStyle}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.rows.length > 10 && <div style={{ fontSize: 12, color: "#5a5e72", marginTop: 8 }}>...y {report.rows.length - 10} más</div>}
            </div>
          </div>

          {!results && (
            <>
              <button onClick={handleImport} disabled={importing} style={{ width: "100%", padding: "16px 28px", borderRadius: 10, border: "none", fontSize: 16, fontWeight: 900, cursor: importing ? "wait" : "pointer", fontFamily: "inherit", background: importing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #059669)", color: importing ? "#5a5e72" : "#fff" }}>
                {importing ? `Importando ${progress} de ${report.rows.length}...` : `Importar ${report.rows.length} Clientes`}
              </button>
              {importing && (
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", marginTop: 12, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#10b981", transition: "width .2s" }} />
                </div>
              )}
            </>
          )}

          {results && (
            <div style={cardStyle}>
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>Resultados</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ textAlign: "center", padding: 16, background: "rgba(16,185,129,0.1)", borderRadius: 10 }}><div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{results.imported}</div><div style={{ fontSize: 11, color: "#5a5e72" }}>Importados</div></div>
                <div style={{ textAlign: "center", padding: 16, background: "rgba(245,158,11,0.1)", borderRadius: 10 }}><div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b" }}>{results.skipped}</div><div style={{ fontSize: 11, color: "#5a5e72" }}>Duplicados</div></div>
                <div style={{ textAlign: "center", padding: 16, background: "rgba(239,68,68,0.1)", borderRadius: 10 }}><div style={{ fontSize: 28, fontWeight: 900, color: "#ef4444" }}>{results.errors}</div><div style={{ fontSize: 11, color: "#5a5e72" }}>Errores</div></div>
              </div>

              {results.missingEffectiveDate > 0 && (
                <div style={{ fontSize: 13, color: "#f59e0b", marginTop: 14, lineHeight: 1.5 }}>
                  {results.missingEffectiveDate} cliente(s) entraron sin fecha efectiva, así que no tendrán recordatorio de renovación. Agrega esa columna al archivo y vuelve a subirlo para completarlos.
                </div>
              )}

              {problems.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#8b8fa3" }}>Filas no importadas</div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {problems.map((p, i) => (
                      <div key={`${p.line}-${i}`} style={{ fontSize: 12, color: "#5a5e72", padding: "3px 0" }}>
                        Fila {p.line} — {REASON_LABELS[p.reason] ?? p.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => router.push("/agentes/dashboard")} style={{ width: "100%", marginTop: 20, padding: "14px 28px", borderRadius: 10, border: "none", fontSize: 16, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff" }}>
                Ver mis clientes
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
