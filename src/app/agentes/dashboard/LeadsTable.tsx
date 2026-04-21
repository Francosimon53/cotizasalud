"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import StatusModal from "./StatusModal";

interface Lead {
  id: string;
  created_at: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  zipcode: string;
  county: string;
  state: string;
  household_size: number;
  annual_income: number;
  fpl_percentage: number;
  status: string;
  selected_plan: any;
  selected_plan_name: string | null;
  selected_premium: number | null;
  contacted_at: string | null;
  quoted_at: string | null;
  next_followup_date: string | null;
}

const STATUSES = [
  { value: "browsing", label: "Visitante", color: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.3)" },
  { value: "new", label: "Nuevo", color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
  { value: "contacted", label: "Contactado", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  { value: "quoted", label: "Cotizado", color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)" },
  { value: "enrolled", label: "Inscrito", color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
  { value: "lost", label: "Perdido", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
];
const statusMap = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "short", timeZone: "America/New_York" });
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

type SLA = "urgent" | "stale" | "at_risk" | null;

function getSLA(lead: Lead): SLA {
  const now = Date.now();
  if (lead.status === "new" && (now - new Date(lead.created_at).getTime()) > 3600000) return "urgent";
  if (lead.status === "contacted" && lead.contacted_at && (now - new Date(lead.contacted_at).getTime()) > 86400000) return "stale";
  if (lead.status === "quoted" && lead.quoted_at && (now - new Date(lead.quoted_at).getTime()) > 432000000) return "at_risk";
  return null;
}

const slaConfig = {
  urgent: { label: "Urgente", color: "#ef4444", border: "rgba(239,68,68,0.4)" },
  stale: { label: "Estancado", color: "#f59e0b", border: "rgba(245,158,11,0.4)" },
  at_risk: { label: "En riesgo", color: "#f97316", border: "rgba(249,115,22,0.4)" },
};

const METAL_COLORS: Record<string, string> = {
  gold: "#FFD700", silver: "#C0C0C0", bronze: "#CD7F32", platinum: "#4A90D9", catastrophic: "#6b7280",
};

function detectMetal(name: string): { label: string; color: string } | null {
  const l = name.toLowerCase();
  if (l.includes("gold") || l.includes("oro")) return { label: "GOLD", color: METAL_COLORS.gold };
  if (l.includes("silver") || l.includes("plata")) return { label: "SILVER", color: METAL_COLORS.silver };
  if (l.includes("bronze") || l.includes("bronce")) return { label: "BRONZE", color: METAL_COLORS.bronze };
  if (l.includes("platinum") || l.includes("platino")) return { label: "PLAT", color: METAL_COLORS.platinum };
  if (l.includes("catastrophic")) return { label: "CAT", color: METAL_COLORS.catastrophic };
  return null;
}

function getPlanName(lead: Lead): string {
  if (lead.selected_plan_name) return lead.selected_plan_name;
  if (lead.selected_plan && typeof lead.selected_plan === "object" && lead.selected_plan.name) return lead.selected_plan.name;
  if (lead.selected_plan && typeof lead.selected_plan === "string") return lead.selected_plan;
  return "";
}

function getPlanPremium(lead: Lead): number | null {
  if (lead.selected_premium != null && lead.selected_premium > 0) return lead.selected_premium;
  if (lead.selected_plan && typeof lead.selected_plan === "object") {
    const p = lead.selected_plan.afterSubsidy ?? lead.selected_plan.premium;
    if (p != null && p > 0) return p;
  }
  return null;
}

export default function LeadsTable({ leads: initialLeads, onRefresh }: { leads: Lead[]; onRefresh?: () => void }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"date" | "status">("date");
  const [modal, setModal] = useState<{ leadId: string; leadName: string; currentStatus: string; newStatus: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleStatusSelect = (lead: Lead, newStatus: string) => {
    if (newStatus === lead.status) return;
    setModal({ leadId: lead.id, leadName: lead.contact_name || "Lead", currentStatus: lead.status, newStatus });
  };

  const handleSaved = (leadId: string, newStatus: string) => {
    const now = new Date().toISOString();
    setLeads((prev) => prev.map((l) => {
      if (l.id !== leadId) return l;
      const update: Partial<Lead> = { status: newStatus };
      if (newStatus === "contacted") update.contacted_at = now;
      if (newStatus === "quoted") update.quoted_at = now;
      return { ...l, ...update };
    }));
  };

  const handleDelete = async (ids: string[]) => {
    setDeleting(true);
    for (const id of ids) {
      try { await fetch(`/api/leads/${id}`, { method: "DELETE" }); } catch {}
    }
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    setSelected(new Set());
    setDeleteTarget(null);
    setDeleting(false);
    if (onRefresh) onRefresh();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Urgent leads: new > 1hr or contacted > 24hr
  const urgentLeads = useMemo(() => {
    return leads.filter((l) => {
      const sla = getSLA(l);
      return sla === "urgent" || sla === "stale";
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        (l.contact_name || "").toLowerCase().includes(q) ||
        (l.contact_phone || "").includes(q) ||
        (l.contact_email || "").toLowerCase().includes(q)
      );
    }
    if (sortKey === "status") {
      const order = ["new", "contacted", "quoted", "enrolled", "lost", "browsing"];
      result = [...result].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    } else {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return result;
  }, [leads, search, statusFilter, sortKey]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 8,
    border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 13,
    background: "#0F172A", color: "#E2E8F0", fontFamily: "inherit", outline: "none",
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 10px", fontSize: 10, fontWeight: 700, color: "#94A3B8",
    textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 10px", fontSize: 13, color: "#E2E8F0",
    borderBottom: "1px solid #1E293B",
  };

  function renderRow(lead: Lead) {
    const st = statusMap[lead.status] || statusMap.new;
    const sla = getSLA(lead);
    const slaInfo = sla ? slaConfig[sla] : null;
    const displayName = lead.contact_name || "Visitante anónimo";
    const hasPhone = lead.contact_phone && lead.contact_phone.length > 0;
    return (
      <tr
        key={lead.id}
        onClick={() => router.push(`/agentes/dashboard/${lead.id}`)}
        style={{ cursor: "pointer", borderLeft: slaInfo ? `3px solid ${slaInfo.border}` : "3px solid transparent" }}
      >
        <td style={{ ...tdStyle, width: 36, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} style={{ accentColor: "#10b981", cursor: "pointer" }} />
        </td>
        <td style={{ ...tdStyle, fontWeight: 700 }}>
          {lead.contact_name ? displayName : <span style={{ fontStyle: "italic", color: "#94A3B8" }}>{displayName}</span>}
          {lead.next_followup_date && <div style={{ fontSize: 10, color: "#8b5cf6", marginTop: 2 }}>📅 {lead.next_followup_date}</div>}
        </td>
        <td style={tdStyle}>
          {hasPhone ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <a href={`tel:${lead.contact_phone}`} onClick={(e) => e.stopPropagation()} style={{ color: "#10b981", textDecoration: "none" }}>{lead.contact_phone}</a>
              <a
                href={`https://wa.me/${lead.contact_phone.replace(/\D/g, "").length === 10 ? "1" : ""}${lead.contact_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${displayName}, soy tu agente de seguros de salud.`)}`}
                target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: "#25D366", color: "#fff", fontSize: 14, textDecoration: "none", flexShrink: 0 }}
                title="WhatsApp"
              >💬</a>
            </div>
          ) : <span style={{ color: "#475569" }}>—</span>}
        </td>
        <td style={{ ...tdStyle, color: "#94A3B8", whiteSpace: "nowrap" }}>{lead.county ? `${lead.county}, ${lead.state}` : "—"}</td>
        <td style={{ ...tdStyle, color: "#94A3B8", whiteSpace: "nowrap" }}>{lead.annual_income ? `$${Number(lead.annual_income).toLocaleString()}` : "—"}</td>
        <td style={{ ...tdStyle, maxWidth: 200 }}>
          {(() => {
            const name = getPlanName(lead);
            if (!name) return <span style={{ color: "#475569" }}>—</span>;
            const metal = detectMetal(name);
            const premium = getPlanPremium(lead);
            const short = name.length > 20 ? name.slice(0, 20) + "…" : name;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                {metal && <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 900, color: "#000", background: metal.color, lineHeight: "14px" }}>{metal.label}</span>}
                <span style={{ color: "#E2E8F0", fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }} title={name}>{short}</span>
                {premium != null && <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700 }}>${premium}/mes</span>}
              </div>
            );
          })()}
        </td>
        <td style={{ ...tdStyle, color: "#94A3B8", whiteSpace: "nowrap" }}>{formatDate(lead.created_at)}</td>
        <td style={tdStyle}>
          {slaInfo ? (
            <span style={{ fontSize: 10, fontWeight: 800, color: slaInfo.color, padding: "2px 8px", borderRadius: 10, background: `${slaInfo.color}15` }}>
              {slaInfo.label} · {timeAgo(lead.status === "new" ? lead.created_at : lead.status === "contacted" ? (lead.contacted_at || lead.created_at) : (lead.quoted_at || lead.created_at))}
            </span>
          ) : <span style={{ fontSize: 11, color: "#475569" }}>—</span>}
        </td>
        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
          <select
            value={lead.status}
            onChange={(e) => handleStatusSelect(lead, e.target.value)}
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "inherit", color: st.color, background: st.bg, border: `1px solid ${st.border}`, cursor: "pointer", outline: "none" }}
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value} style={{ background: "#1E293B", color: "#E2E8F0" }}>{s.label}</option>)}
          </select>
        </td>
        <td style={{ ...tdStyle, width: 36, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setDeleteTarget([lead.id])} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 16, cursor: "pointer", padding: 4 }} title="Eliminar">🗑️</button>
        </td>
      </tr>
    );
  }

  const tableHead = (
    <thead>
      <tr>
        <th style={{ ...thStyle, width: 36, textAlign: "center" }}>
          <input type="checkbox" checked={allFilteredSelected} onChange={() => {
            if (allFilteredSelected) setSelected(new Set());
            else setSelected(new Set(filtered.map((l) => l.id)));
          }} style={{ accentColor: "#10b981", cursor: "pointer" }} />
        </th>
        <th style={thStyle}>Nombre</th>
        <th style={thStyle}>Teléfono</th>
        <th style={thStyle}>Ubicación</th>
        <th style={thStyle}>Ingreso</th>
        <th style={thStyle}>Plan</th>
        <th style={thStyle}>Fecha</th>
        <th style={thStyle}>SLA</th>
        <th style={thStyle}>Estado</th>
        <th style={{ ...thStyle, width: 36 }}></th>
      </tr>
    </thead>
  );

  return (
    <>
      {modal && (
        <StatusModal leadId={modal.leadId} leadName={modal.leadName} currentStatus={modal.currentStatus} newStatus={modal.newStatus} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setDeleteTarget(null)}>
          <div style={{ background: "#1E293B", borderRadius: 16, padding: 28, border: "1px solid rgba(239,68,68,0.3)", width: "100%", maxWidth: 400, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#E2E8F0", marginBottom: 8 }}>
              {deleteTarget.length === 1 ? "¿Eliminar este lead?" : `¿Eliminar ${deleteTarget.length} leads?`}
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 24, lineHeight: 1.5 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94A3B8", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={deleting} style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontSize: 14, fontWeight: 800, cursor: deleting ? "wait" : "pointer", fontFamily: "inherit" }}>{deleting ? "..." : "Eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Acción Hoy — same table format, red header */}
      {urgentLeads.length > 0 && (
        <div style={{ background: "#1E293B", borderRadius: 16, border: "1px solid rgba(239,68,68,0.2)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 18px", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#ef4444" }}>Acción Hoy</span>
            <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 800, color: "#ef4444", background: "rgba(239,68,68,0.15)" }}>{urgentLeads.length}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              {tableHead}
              <tbody>{urgentLeads.map((lead) => renderRow(lead))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Leads Table */}
      <div style={{ background: "#1E293B", borderRadius: 16, border: "1px solid #334155", overflow: "hidden" }}>
        {/* Filters */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#E2E8F0", marginRight: "auto" }}>
            Leads
            <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, marginLeft: 8 }}>{filtered.length}/{leads.length}</span>
          </div>
          {selected.size > 0 && (
            <button onClick={() => setDeleteTarget(Array.from(selected))} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              🗑️ Eliminar seleccionados ({selected.size})
            </button>
          )}
          <input style={{ ...inputStyle, width: 170 }} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={{ ...inputStyle, cursor: "pointer" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={sortKey} onChange={(e) => setSortKey(e.target.value as "date" | "status")}>
            <option value="date">Fecha</option>
            <option value="status">Estado</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
            {leads.length === 0 ? "Sin leads todavía" : "Sin resultados"}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              {tableHead}
              <tbody>{filtered.map((lead) => renderRow(lead))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
