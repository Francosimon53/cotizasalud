"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ShareCard({ slug }: { slug: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const url = `https://www.enrollsalud.com/q/${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(6,182,212,0.10))",
      border: "1.5px solid rgba(16,185,129,0.35)",
      borderRadius: 16, padding: 22, marginBottom: 20,
      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, textTransform: "uppercase",
          letterSpacing: 0.6, color: "#86efac", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 6,
        }}>🚀 Tu link personal</div>
        <div style={{
          fontSize: 22, fontWeight: 900, color: "#10b981",
          wordBreak: "break-all", lineHeight: 1.25, letterSpacing: -0.3,
        }}>
          enrollsalud.com/q/{slug}
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 8 }}>
          Los clientes que entren por tu link aparecerán aquí automáticamente.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={handleCopy} style={{
          padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
          border: "none", cursor: "pointer", fontFamily: "inherit",
          background: copied ? "#059669" : "#10b981",
          color: "#000", transition: "all .2s", whiteSpace: "nowrap",
        }}>{copied ? "¡Copiado!" : "📋 Copiar link"}</button>
        <button onClick={() => router.push("/agentes/dashboard/share")} style={{
          padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
          border: "1.5px solid rgba(16,185,129,0.4)", cursor: "pointer", fontFamily: "inherit",
          background: "transparent", color: "#10b981", whiteSpace: "nowrap",
        }}>📣 Compartir</button>
        <button onClick={() => router.push("/agentes/dashboard/share")} style={{
          padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
          border: "1.5px solid rgba(255,255,255,0.15)", cursor: "pointer", fontFamily: "inherit",
          background: "transparent", color: "#E2E8F0", whiteSpace: "nowrap",
        }}>📱 Ver QR</button>
      </div>
    </div>
  );
}
