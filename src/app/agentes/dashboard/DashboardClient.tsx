"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LeadsTable from "./LeadsTable";
import AddClientModal from "./AddClientModal";

export default function DashboardClient({ leads, agentSlug }: { leads: any[]; agentSlug: string }) {
  const router = useRouter();
  const [showAddClient, setShowAddClient] = useState(false);

  return (
    <>
      {/* Add Client button */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
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
      </div>

      {showAddClient && (
        <AddClientModal
          agentSlug={agentSlug}
          onClose={() => setShowAddClient(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <LeadsTable leads={leads} onRefresh={() => router.refresh()} />
    </>
  );
}
