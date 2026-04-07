"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DashboardHeader({ agentName, agencyName }: { agentName: string; agencyName?: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/agentes/login");
  };

  return (
    <header style={{
      background: "rgba(8,9,13,0.9)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "14px 20px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, #10b981, #06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 900, color: "#000",
        }}>ES</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f1f5" }}>
            {agencyName || agentName}
          </div>
          <div style={{ fontSize: 11, color: "#5a5e72" }}>Panel de Agente</div>
        </div>
      </div>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        style={{
          padding: "8px 18px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          color: "#8b8fa3",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {loggingOut ? "..." : "Cerrar Sesión"}
      </button>
    </header>
  );
}
