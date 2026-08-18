"use client";

import { useEffect, useMemo, useState } from "react";
import { captureCarteraVista } from "@/lib/analytics";
import { razonEnEspanol, NIVELES_ES } from "@/lib/cartera/razones";
import type { RiskLevel } from "@/lib/cartera/scoring";
import ImportCarteraClient from "./ImportCarteraClient";

export interface PortfolioClientRow {
  id: string;
  full_name: string;
  estimated_age: number | null;
  date_of_birth: string | null;
  zip_code: string | null;
  county: string | null;
  household_members: number | null;
  current_carrier: string | null;
  metal_level: string | null;
  monthly_premium: number | null;
  monthly_subsidy: number | null;
  auto_renewal: boolean | null;
  phone: string | null;
  email: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  risk_reasons: string[];
  score_confidence: number;
}

export interface PortfolioImportRow {
  id: string;
  file_name: string | null;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  // Nullable: imports recorded before the Fase B migration lack these counts.
  inserted_rows: number | null;
  updated_rows: number | null;
  possible_duplicates: number | null;
  created_at: string;
}

const LEVEL_COLORS: Record<RiskLevel, { fg: string; bg: string }> = {
  critical: { fg: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  high: { fg: "#f97316", bg: "rgba(249,115,22,0.12)" },
  medium: { fg: "#eab308", bg: "rgba(234,179,8,0.12)" },
  low: { fg: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

const METAL_ES: Record<string, string> = {
  bronze: "Bronce",
  silver: "Plata",
  gold: "Oro",
  platinum: "Platino",
};

const card: React.CSSProperties = {
  background: "#12141c",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: 20,
};

function Badge({ level }: { level: RiskLevel }) {
  const c = LEVEL_COLORS[level] ?? LEVEL_COLORS.low;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: c.fg, background: c.bg, border: `1px solid ${c.fg}33`, whiteSpace: "nowrap",
    }}>
      {NIVELES_ES[level] ?? level}
    </span>
  );
}

export default function CarteraClient({
  initialClients,
  initialImports,
}: {
  initialClients: PortfolioClientRow[];
  initialImports: PortfolioImportRow[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [imports, setImports] = useState(initialImports);
  const [filter, setFilter] = useState<RiskLevel | "todos">("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const counts = useMemo(() => {
    const by = { critical: 0, high: 0, medium: 0, low: 0 } as Record<RiskLevel, number>;
    for (const c of clients) by[c.risk_level] = (by[c.risk_level] ?? 0) + 1;
    return by;
  }, [clients]);

  useEffect(() => {
    captureCarteraVista({
      clientes_total: clients.length,
      criticos: counts.critical,
      altos: counts.high,
    });
    // Only on first render: one page view = one event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      const res = await fetch("/api/cartera");
      if (!res.ok) return;
      const data = await res.json();
      setClients(data.clients || []);
      setImports(data.imports || []);
    } catch {
      // la vista conserva los datos actuales
    }
  };

  const visible = filter === "todos" ? clients : clients.filter((c) => c.risk_level === filter);

  const filterBtn = (active: boolean, color?: string): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? (color ?? "#06b6d4") : "rgba(255,255,255,0.1)"}`,
    background: active ? `${color ?? "#06b6d4"}22` : "transparent",
    color: active ? (color ?? "#06b6d4") : "#8b8fa3", cursor: "pointer", fontFamily: "inherit",
  });

  const fmtUsd = (n: number | null) => (n == null ? "—" : `$${n.toLocaleString("en-US")}`);

  return (
    <div className="ph-no-capture">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Mi Cartera</h1>
          <p style={{ fontSize: 13, color: "#8b8fa3", margin: "4px 0 0" }}>
            Tu cartera de clientes ordenada por riesgo de perderse en la renovación de noviembre 2026
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {imports.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)} style={filterBtn(showHistory)}>
              Historial de importaciones
            </button>
          )}
          <button
            onClick={() => setShowImport(!showImport)}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: "none", background: "linear-gradient(135deg, #10b981, #06b6d4)",
              color: "#000", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {showImport ? "Cerrar importación" : "Importar CSV"}
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ ...card, marginBottom: 20 }}>
          <ImportCarteraClient
            onImported={() => {
              setShowImport(false);
              refresh();
            }}
          />
        </div>
      )}

      {showHistory && imports.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Historial de importaciones</div>
          {imports.map((imp) => (
            <div key={imp.id} style={{ display: "flex", gap: 16, fontSize: 12, color: "#8b8fa3", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
              <span style={{ color: "#f0f1f5", minWidth: 160 }}>{imp.file_name || "archivo.csv"}</span>
              <span>{new Date(imp.created_at).toLocaleDateString("es-US")}</span>
              <span>{imp.total_rows} filas</span>
              {imp.inserted_rows != null && <span style={{ color: "#10b981" }}>{imp.inserted_rows} nuevos</span>}
              {imp.updated_rows != null && <span style={{ color: "#06b6d4" }}>{imp.updated_rows} actualizados</span>}
              {(imp.possible_duplicates ?? 0) > 0 && (
                <span style={{ color: "#eab308" }}>{imp.possible_duplicates} posibles duplicados por nombre</span>
              )}
              {imp.error_rows > 0 && <span style={{ color: "#f97316" }}>{imp.error_rows} con error</span>}
            </div>
          ))}
        </div>
      )}

      {clients.length === 0 ? (
        !showImport && (
          <div style={{ ...card, textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Tu cartera está vacía</div>
            <p style={{ fontSize: 13, color: "#8b8fa3", maxWidth: 420, margin: "0 auto 20px" }}>
              Importa tu cartera de clientes y te decimos a quiénes estás a punto de perder
              en la renovación, ordenados por riesgo.
            </p>
            <button
              onClick={() => setShowImport(true)}
              style={{
                padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                border: "none", background: "linear-gradient(135deg, #10b981, #06b6d4)",
                color: "#000", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Importar mi cartera (CSV)
            </button>
          </div>
        )
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
            {([
              ["critical", counts.critical],
              ["high", counts.high],
              ["medium", counts.medium],
              ["low", counts.low],
            ] as [RiskLevel, number][]).map(([level, n]) => (
              <div key={level} style={{ ...card, padding: 14, borderColor: `${LEVEL_COLORS[level].fg}33` }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: LEVEL_COLORS[level].fg }}>{n}</div>
                <div style={{ fontSize: 12, color: "#8b8fa3" }}>{NIVELES_ES[level]}</div>
              </div>
            ))}
            <div style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{clients.length}</div>
              <div style={{ fontSize: 12, color: "#8b8fa3" }}>Total</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setFilter("todos")} style={filterBtn(filter === "todos")}>Todos</button>
            {(["critical", "high", "medium", "low"] as RiskLevel[]).map((level) => (
              <button key={level} onClick={() => setFilter(level)} style={filterBtn(filter === level, LEVEL_COLORS[level].fg)}>
                {NIVELES_ES[level]}
              </button>
            ))}
          </div>

          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#8b8fa3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  <th style={{ padding: "12px 16px" }}>Cliente</th>
                  <th style={{ padding: "12px 8px" }}>Riesgo</th>
                  <th style={{ padding: "12px 8px" }}>Puntaje</th>
                  <th style={{ padding: "12px 8px" }}>Prima</th>
                  <th style={{ padding: "12px 8px" }}>Subsidio</th>
                  <th style={{ padding: "12px 8px" }}>Metal</th>
                  <th style={{ padding: "12px 8px" }}>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    expanded={expandedId === c.id}
                    onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    fmtUsd={fmtUsd}
                  />
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <div style={{ padding: 24, fontSize: 13, color: "#8b8fa3", textAlign: "center" }}>
                Ningún cliente en este nivel de riesgo.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ClientRow({
  client: c,
  expanded,
  onToggle,
  fmtUsd,
}: {
  client: PortfolioClientRow;
  expanded: boolean;
  onToggle: () => void;
  fmtUsd: (n: number | null) => string;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", background: expanded ? "rgba(255,255,255,0.03)" : "transparent" }}
      >
        <td style={{ padding: "10px 16px", fontWeight: 600 }}>{c.full_name}</td>
        <td style={{ padding: "10px 8px" }}><Badge level={c.risk_level} /></td>
        <td style={{ padding: "10px 8px", fontWeight: 700, color: LEVEL_COLORS[c.risk_level]?.fg }}>{c.risk_score}</td>
        <td style={{ padding: "10px 8px" }}>{fmtUsd(c.monthly_premium)}</td>
        <td style={{ padding: "10px 8px" }}>{fmtUsd(c.monthly_subsidy)}</td>
        <td style={{ padding: "10px 8px" }}>{c.metal_level ? METAL_ES[c.metal_level] ?? c.metal_level : "—"}</td>
        <td style={{ padding: "10px 8px", color: "#8b8fa3" }}>{c.score_confidence}%</td>
      </tr>
      {expanded && (
        <tr style={{ background: "rgba(255,255,255,0.02)" }}>
          <td colSpan={7} style={{ padding: "12px 16px 16px" }}>
            {c.risk_reasons.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#d1d4e0", lineHeight: 1.8 }}>
                {c.risk_reasons.map((key) => (
                  <li key={key}>{razonEnEspanol(key)}</li>
                ))}
              </ul>
            ) : (
              <span style={{ fontSize: 13, color: "#8b8fa3" }}>Sin señales de riesgo con los datos disponibles.</span>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#8b8fa3", flexWrap: "wrap" }}>
              {c.estimated_age != null && <span>Edad: {c.estimated_age}</span>}
              {c.household_members != null && <span>Hogar: {c.household_members}</span>}
              {c.county && <span>Condado: {c.county}</span>}
              {c.zip_code && <span>ZIP: {c.zip_code}</span>}
              {c.current_carrier && <span>Aseguradora: {c.current_carrier}</span>}
              {c.auto_renewal != null && <span>Renovación automática: {c.auto_renewal ? "Sí" : "No"}</span>}
              {c.phone && <span>Tel: {c.phone}</span>}
              {c.email && <span>{c.email}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
