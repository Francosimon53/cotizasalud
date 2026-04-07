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
    <div>
      <div style={{ fontSize: 10, color: "#5a5e72", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>Tu Link</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981", marginTop: 4, wordBreak: "break-all" }}>
        enrollsalud.com/q/{slug}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button onClick={handleCopy} style={{
          padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
          border: "none", cursor: "pointer", fontFamily: "inherit",
          background: copied ? "#10b981" : "rgba(16,185,129,0.15)",
          color: copied ? "#000" : "#10b981",
          transition: "all .2s",
        }}>{copied ? "Copiado!" : "Copiar"}</button>
        <button onClick={() => router.push("/agentes/dashboard/share")} style={{
          padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
          border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
          color: "#8b8fa3", cursor: "pointer", fontFamily: "inherit",
        }}>Compartir</button>
      </div>
    </div>
  );
}
