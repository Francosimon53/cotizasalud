"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DashboardHeader({ agentName, agencyName, isAdmin }: { agentName: string; agencyName?: string; isAdmin?: boolean }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/agentes/login");
  };

  return (
    <header className="dh-header">
      <div className="dh-brand">
        <div className="dh-logo" onClick={() => router.push("/agentes/dashboard")}>ES</div>
        <div className="dh-brand-text">
          <div className="dh-brand-name">{agencyName || agentName}</div>
          <div className="dh-brand-sub">Panel de Agente</div>
        </div>
      </div>
      <div className="dh-nav">
        {isAdmin && (
          <button onClick={() => router.push("/agentes/dashboard/team")} className="dh-btn dh-btn-admin">
            Equipo
          </button>
        )}
        <button onClick={() => router.push("/agentes/dashboard/renewals")} className="dh-btn">
          Renovaciones
        </button>
        <button onClick={() => router.push("/agentes/dashboard/import")} className="dh-btn">
          Importar
        </button>
        <button onClick={() => router.push("/agentes/dashboard/share")} className="dh-btn">
          Compartir
        </button>
        <button onClick={() => router.push("/agentes/dashboard/profile")} className="dh-btn">
          Perfil
        </button>
        <button onClick={handleLogout} disabled={loggingOut} className="dh-btn">
          {loggingOut ? "..." : "Salir"}
        </button>
      </div>
    </header>
  );
}
