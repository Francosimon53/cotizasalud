"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error.message, error.stack);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#64748B", marginBottom: 24, lineHeight: 1.6 }}>Por favor recarga la página.</p>
          <button onClick={reset} style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "#0D9488", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Recargar</button>
        </div>
      </body>
    </html>
  );
}
