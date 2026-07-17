"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LeadsTable from "./LeadsTable";
import AddClientModal from "./AddClientModal";
import { captureLeadsExportados } from "@/lib/analytics";

export default function DashboardClient({ leads, agentSlug }: { leads: any[]; agentSlug: string }) {
  const router = useRouter();
  const [showAddClient, setShowAddClient] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setExportError(false);
    try {
      const res = await fetch("/api/leads/export");
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const cantidad = Number(res.headers.get("X-Total-Count") ?? 0);
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `leads-enrollsalud-${new Date().toISOString().split("T")[0]}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      captureLeadsExportados(cantidad);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    // ph-no-capture: session replay must never record lead data.
    <div className="ph-no-capture">
      {/* Add Client button */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => setShowAddClient(true)}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#fff", fontSize: 14, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          + Agregar Cliente
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: "10px 20px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: exporting ? "#5a5e72" : "#8b8fa3",
            fontSize: 14, fontWeight: 800,
            cursor: exporting ? "wait" : "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {exporting ? "Exportando..." : "⬇ Exportar CSV"}
        </button>
        {exportError && (
          <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
            No se pudo exportar. Intenta de nuevo.
          </span>
        )}
      </div>

      {showAddClient && (
        <AddClientModal
          agentSlug={agentSlug}
          onClose={() => setShowAddClient(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <LeadsTable leads={leads} onRefresh={() => router.refresh()} />
    </div>
  );
}
