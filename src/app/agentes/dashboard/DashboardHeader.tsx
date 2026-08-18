"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAdminSlug } from "@/lib/admin-slugs";
import { isCarteraEnabled } from "@/lib/feature-flags";

// El admin se resuelve aquí a partir del slug, no vía prop: antes cada página
// tenía que acordarse de pasar `isAdmin` y solo una de las seis lo hacía, así
// que "Equipo" desaparecía al salir del panel principal.
export default function DashboardHeader({ agentName, agencyName, agentSlug }: { agentName: string; agencyName?: string; agentSlug: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const isAdmin = isAdminSlug(agentSlug);

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
        {isCarteraEnabled() && (
          <button onClick={() => router.push("/agentes/dashboard/cartera")} className="dh-btn dh-btn-cartera">
            Mi Cartera
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
