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
  selected_plan: string | null;
  contacted_at: string | null;
  quoted_at: string | null;
  next_followup_date: string | null;
}

const STATUSES = [
  { value: "new", label: "Nuevo", color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
  { value: "contacted", label: "Contactado", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  { value: "quoted", label: "Cotizado", color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)" },
  { value: "enrolled", label: "Inscrito", color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
  { value: "lost", label: "Perdido", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
];
const statusMap = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "short" });
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
  if (lead.status === "contacted" && lead.contacted_at && (now - new Date(lead.contacted_at).getTime()) > 172800000) return "stale";
  if (lead.status === "quoted" && lead.quoted_at && (now - new Date(lead.quoted_at).getTime()) > 432000000) return "at_risk";
  return null;
}

const slaConfig = {
  urgent: { label: "Urgente", color: "#ef4444", border: "rgba(239,68,68,0.4)" },
  stale: { label: "Estancado", color: "#f59e0b", border: "rgba(245,158,11,0.4)" },
  at_risk: { label: "En riesgo", color: "#f97316", border: "rgba(249,115,22,0.4)" },
};

export default function LeadsTable({ leads: initialLeads }: { leads: Lead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"date" | "status">("date");
  const [modal, setModal] = useState<{ leadId: string; leadName: string; currentStatus: string; newStatus: string } | null>(null);

  const handleStatusSelect = (lead: Lead, newStatus: string) => {
    if (newStatus === lead.status) return;
    setModal({ leadId: lead.id, leadName: lead.contact_name, currentStatus: lead.status, newStatus });
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

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.contact_name.toLowerCase().includes(q) ||
        l.contact_phone.includes(q) ||
        l.contact_email?.toLowerCase().includes(q)
      );
    }
    if (sortKey === "status") {
      const order = ["new", "contacted", "quoted", "enrolled", "lost"];
      result = [...result].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    } else {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return result;
  }, [leads, search, statusFilter, sortKey]);

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 8,
    border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 13,
    background: "#0e1018", color: "#f0f1f5", fontFamily: "inherit", outline: "none",
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 10, fontWeight: 700, color: "#5a5e72",
    textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 13, color: "#f0f1f5",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  };

  return (
    <>
      {modal && (
        <StatusModal
          leadId={modal.leadId}
          leadName={modal.leadName}
          currentStatus={modal.currentStatus}
          newStatus={modal.newStatus}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      <div style={{
        background: "#12141c", borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
      }}>
        {/* Filters */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#f0f1f5", marginRight: "auto" }}>
            Leads
            <span style={{ fontSize: 12, color: "#5a5e72", fontWeight: 600, marginLeft: 8 }}>
              {filtered.length}/{leads.length}
            </span>
          </div>
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
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#5a5e72", fontSize: 14 }}>
            {leads.length === 0 ? "Sin leads todavía" : "Sin resultados"}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Teléfono</th>
                  <th style={thStyle}>Ubicación</th>
                  <th style={thStyle}>Ingreso</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>SLA</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const st = statusMap[lead.status] || statusMap.new;
                  const sla = getSLA(lead);
                  const slaInfo = sla ? slaConfig[sla] : null;
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => router.push(`/agentes/dashboard/${lead.id}`)}
                      style={{
                        cursor: "pointer",
                        borderLeft: slaInfo ? `3px solid ${slaInfo.border}` : "3px solid transparent",
                      }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        {lead.contact_name}
                        {lead.next_followup_date && (
                          <div style={{ fontSize: 10, color: "#8b5cf6", marginTop: 2 }}>
                            📅 {lead.next_followup_date}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <a href={`tel:${lead.contact_phone}`} onClick={(e) => e.stopPropagation()} style={{ color: "#10b981", textDecoration: "none" }}>
                            {lead.contact_phone}
                          </a>
                          <a
                            href={`https://wa.me/${lead.contact_phone.replace(/\D/g, "").length === 10 ? "1" : ""}${lead.contact_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${lead.contact_name}, soy tu agente de seguros de salud. Recibí tu interés en un plan del Marketplace. ¿Tienes unos minutos para hablar sobre tu cobertura?`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 28, height: 28, borderRadius: 6,
                              background: "#25D366", color: "#fff", fontSize: 14,
                              textDecoration: "none", flexShrink: 0,
                            }}
                            title="WhatsApp"
                          >💬</a>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: "#8b8fa3", whiteSpace: "nowrap" }}>{lead.county}, {lead.state}</td>
                      <td style={{ ...tdStyle, color: "#8b8fa3", whiteSpace: "nowrap" }}>${Number(lead.annual_income).toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: "#8b8fa3", whiteSpace: "nowrap" }}>
                        {formatDate(lead.created_at)}
                      </td>
                      <td style={tdStyle}>
                        {slaInfo ? (
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: slaInfo.color,
                            padding: "2px 8px", borderRadius: 10,
                            background: `${slaInfo.color}15`,
                          }}>
                            {slaInfo.label} · {timeAgo(lead.status === "new" ? lead.created_at : lead.status === "contacted" ? (lead.contacted_at || lead.created_at) : (lead.quoted_at || lead.created_at))}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#3a3d4a" }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusSelect(lead, e.target.value)}
                          style={{
                            padding: "4px 8px", borderRadius: 6, fontSize: 11,
                            fontWeight: 700, fontFamily: "inherit",
                            color: st.color, background: st.bg,
                            border: `1px solid ${st.border}`,
                            cursor: "pointer", outline: "none",
                          }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value} style={{ background: "#12141c", color: "#f0f1f5" }}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
