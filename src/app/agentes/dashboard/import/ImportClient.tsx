"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface ParsedRow {
  name: string;
  phone: string;
  email: string;
  planName: string;
  premium: string;
  effectiveDate: string;
  status: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const get = (keys: string[]) => {
      for (const k of keys) {
        const idx = headers.indexOf(k);
        if (idx >= 0 && vals[idx]) return vals[idx];
      }
      return "";
    };
    const firstName = get(["first name", "first_name", "firstname"]);
    const lastName = get(["last name", "last_name", "lastname"]);
    return {
      name: `${firstName} ${lastName}`.trim() || get(["name", "full name", "full_name"]),
      phone: get(["phone", "phone number", "phone_number", "mobile"]),
      email: get(["email", "email address", "email_address"]),
      planName: get(["plan name", "plan_name", "plan"]),
      premium: get(["premium", "monthly premium", "monthly_premium"]),
      effectiveDate: get(["effective date", "effective_date", "start date", "start_date"]),
      status: get(["status", "enrollment status", "enrollment_status"]),
    };
  }).filter((r) => r.name);
}

export default function ImportClient({ agentSlug }: { agentSlug: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ imported: number; skipped: number; errors: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text));
      setResults(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    let imported = 0, skipped = 0, errors = 0;

    for (const row of rows) {
      try {
        const res = await fetch("/api/leads/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...row, agentSlug }),
        });
        const data = await res.json();
        if (data.skipped) skipped++;
        else if (data.success) imported++;
        else errors++;
      } catch { errors++; }
    }

    setResults({ imported, skipped, errors });
    setImporting(false);
  };

  const cardStyle: React.CSSProperties = {
    background: "#12141c", borderRadius: 16, padding: 24,
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20,
  };

  return (
    <>
      <button onClick={() => router.push("/agentes/dashboard")} style={{ padding: "6px 14px", borderRadius: 8, marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Dashboard</button>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Importar Clientes</h1>
      <p style={{ fontSize: 14, color: "#5a5e72", marginBottom: 24 }}>Sube un CSV exportado de HealthSherpa para importar tus clientes.</p>

      <div style={cardStyle}>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "20px", borderRadius: 10, border: "2px dashed rgba(255,255,255,0.15)", background: "transparent", color: "#8b8fa3", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          📄 Seleccionar archivo CSV
        </button>
      </div>

      {rows.length > 0 && (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Vista Previa ({rows.length} registros)</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Nombre", "Teléfono", "Email", "Plan", "Prima", "Fecha", "Estado"].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", color: "#5a5e72", fontWeight: 700, textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "6px 8px", color: "#f0f1f5", fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "6px 8px", color: "#8b8fa3" }}>{r.phone}</td>
                      <td style={{ padding: "6px 8px", color: "#8b8fa3" }}>{r.email}</td>
                      <td style={{ padding: "6px 8px", color: "#8b8fa3" }}>{r.planName}</td>
                      <td style={{ padding: "6px 8px", color: "#8b8fa3" }}>{r.premium}</td>
                      <td style={{ padding: "6px 8px", color: "#8b8fa3" }}>{r.effectiveDate}</td>
                      <td style={{ padding: "6px 8px", color: "#8b8fa3" }}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && <div style={{ fontSize: 12, color: "#5a5e72", marginTop: 8 }}>...y {rows.length - 10} más</div>}
            </div>
          </div>

          {!results && (
            <button onClick={handleImport} disabled={importing} style={{ width: "100%", padding: "16px 28px", borderRadius: 10, border: "none", fontSize: 16, fontWeight: 900, cursor: importing ? "wait" : "pointer", fontFamily: "inherit", background: importing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #059669)", color: importing ? "#5a5e72" : "#fff" }}>
              {importing ? `Importando... (${rows.length} registros)` : `Importar ${rows.length} Clientes`}
            </button>
          )}

          {results && (
            <div style={cardStyle}>
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>Resultados</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ textAlign: "center", padding: 16, background: "rgba(16,185,129,0.1)", borderRadius: 10 }}><div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{results.imported}</div><div style={{ fontSize: 11, color: "#5a5e72" }}>Importados</div></div>
                <div style={{ textAlign: "center", padding: 16, background: "rgba(245,158,11,0.1)", borderRadius: 10 }}><div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b" }}>{results.skipped}</div><div style={{ fontSize: 11, color: "#5a5e72" }}>Duplicados</div></div>
                <div style={{ textAlign: "center", padding: 16, background: "rgba(239,68,68,0.1)", borderRadius: 10 }}><div style={{ fontSize: 28, fontWeight: 900, color: "#ef4444" }}>{results.errors}</div><div style={{ fontSize: 11, color: "#5a5e72" }}>Errores</div></div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
