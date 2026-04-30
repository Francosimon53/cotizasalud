"use client";

import Link from "next/link";
import { useState } from "react";

const ACCENT = "#10b981";

export default function DistributionKitCard() {
  const [hover, setHover] = useState(false);

  return (
    <Link
      href="/agentes/dashboard/share"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        textDecoration: "none",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))",
          border: "1.5px solid rgba(16,185,129,0.25)",
          borderRadius: 16,
          padding: 22,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          cursor: "pointer",
          transition: "box-shadow .2s, border-color .2s",
          boxShadow: hover ? "0 12px 32px rgba(16,185,129,0.18)" : "none",
          borderColor: hover ? "rgba(16,185,129,0.45)" : "rgba(16,185,129,0.25)",
        }}
      >
        <div style={{ fontSize: 44, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
          🎁
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#E2E8F0",
              marginBottom: 6,
              lineHeight: 1.2,
            }}
          >
            Tu kit completo de distribución
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#94A3B8",
              lineHeight: 1.5,
            }}
          >
            QR imprimible · Mensajes WhatsApp · Tracking por canal · Y más
          </div>
        </div>

        <div
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 800,
            background: ACCENT,
            color: "#000",
            whiteSpace: "nowrap",
            transition: "transform .2s",
            transform: hover ? "translateX(2px)" : "translateX(0)",
            fontFamily: "inherit",
          }}
        >
          Abrir kit →
        </div>
      </div>
    </Link>
  );
}
