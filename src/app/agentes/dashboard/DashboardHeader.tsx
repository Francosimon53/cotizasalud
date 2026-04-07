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

  const navBtn: React.CSSProperties = {
    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
    color: "#8b8fa3", cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <header style={{
      background: "rgba(8,9,13,0.9)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "12px 20px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          onClick={() => router.push("/agentes/dashboard")}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #10b981, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: "#000", cursor: "pointer",
          }}
        >ES</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f1f5" }}>
            {agencyName || agentName}
          </div>
          <div style={{ fontSize: 11, color: "#5a5e72" }}>Panel de Agente</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => router.push("/agentes/dashboard/profile")} style={navBtn}>
          Mi Perfil
        </button>
        <button onClick={() => router.push("/agentes/dashboard/share")} style={navBtn}>
          Compartir
        </button>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{ ...navBtn, color: loggingOut ? "#3a3d4a" : "#8b8fa3" }}
        >
          {loggingOut ? "..." : "Salir"}
        </button>
      </div>
    </header>
  );
}
