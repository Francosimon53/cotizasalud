"use client";

import { useRef, useState } from "react";
import {
  parseCsv,
  suggestMapping,
  applyMapping,
  PORTFOLIO_FIELDS,
  FIELD_LABELS_ES,
  type PortfolioField,
} from "@/lib/cartera/csv";
import { captureCarteraImportada } from "@/lib/analytics";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 1000;

interface ImportResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export default function ImportCarteraClient({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(PortfolioField | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("El archivo supera el límite de 2 MB.");
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError("No se encontraron filas en el archivo. Verifica que sea un CSV con encabezados.");
      return;
    }
    if (parsed.rows.length > MAX_ROWS) {
      setError(`El archivo tiene ${parsed.rows.length} filas; el máximo por import es ${MAX_ROWS}.`);
      return;
    }
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(suggestMapping(parsed.headers));
  };

  const confirmImport = async () => {
    if (!mapping.includes("full_name")) {
      setError('Asigna una columna a "Nombre completo" para poder importar.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/cartera/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          rows: rows.map((r) => applyMapping(mapping, r)),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(
          res.status === 429
            ? "Demasiados imports seguidos. Espera unos minutos e intenta de nuevo."
            : "No se pudo completar el import. Intenta de nuevo."
        );
        return;
      }
      captureCarteraImportada({
        filas_totales: data.totalRows,
        filas_validas: data.validRows,
        filas_con_error: data.errorRows,
      });
      setResult({ totalRows: data.totalRows, validRows: data.validRows, errorRows: data.errorRows });
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    background: "#1a1d28", color: "#f0f1f5", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", maxWidth: 190,
  };

  if (result) {
    return (
      <div className="ph-no-capture" style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Import completado</div>
        <p style={{ fontSize: 13, color: "#8b8fa3", margin: "0 0 16px" }}>
          {result.validRows} de {result.totalRows} clientes importados
          {result.errorRows > 0 && ` · ${result.errorRows} filas con error (revisa el historial)`}
        </p>
        <button
          onClick={() => {
            reset();
            onImported();
          }}
          style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none",
            background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#000",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Ver mi cartera
        </button>
      </div>
    );
  }

  return (
    <div className="ph-no-capture">
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Importar cartera desde CSV</div>
      <p style={{ fontSize: 12, color: "#8b8fa3", margin: "0 0 14px" }}>
        Acepta encabezados en español o inglés (nombre/name, prima/premium, subsidio/aptc…).
        Máximo {MAX_ROWS} filas / 2 MB. Las columnas que falten solo reducen la confianza del score.
      </p>

      {headers.length === 0 ? (
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          style={{ fontSize: 13, color: "#8b8fa3" }}
        />
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#8b8fa3", marginBottom: 10 }}>
            <strong style={{ color: "#f0f1f5" }}>{fileName}</strong> · {rows.length} filas ·{" "}
            <button onClick={reset} style={{ background: "none", border: "none", color: "#06b6d4", cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "inherit" }}>
              elegir otro archivo
            </button>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            Mapeo de columnas <span style={{ color: "#8b8fa3", fontWeight: 400 }}>(revisa lo detectado y ajusta si hace falta)</span>
          </div>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                <tr>
                  {headers.map((h, i) => (
                    <td key={i} style={{ padding: "4px 8px 4px 0", verticalAlign: "top" }}>
                      <div style={{ color: "#8b8fa3", marginBottom: 4, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h}>
                        {h || <em>(sin encabezado)</em>}
                      </div>
                      <select
                        value={mapping[i] ?? ""}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[i] = (e.target.value || null) as PortfolioField | null;
                          setMapping(next);
                        }}
                        style={selectStyle}
                      >
                        <option value="">No importar</option>
                        {PORTFOLIO_FIELDS.map((f) => (
                          <option key={f} value={f} disabled={mapping.includes(f) && mapping[i] !== f}>
                            {FIELD_LABELS_ES[f]}
                          </option>
                        ))}
                      </select>
                      <div style={{ color: "#5a5e72", marginTop: 4, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title="">
                        {rows[0]?.[i] ?? ""}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <button
            onClick={confirmImport}
            disabled={sending}
            style={{
              padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none",
              background: sending ? "#2a2d3a" : "linear-gradient(135deg, #10b981, #06b6d4)",
              color: sending ? "#8b8fa3" : "#000", cursor: sending ? "default" : "pointer", fontFamily: "inherit",
            }}
          >
            {sending ? "Importando…" : `Confirmar import de ${rows.length} filas`}
          </button>
        </>
      )}

      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>{error}</div>
      )}
    </div>
  );
}
