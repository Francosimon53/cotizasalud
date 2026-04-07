"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BASE = "https://www.enrollsalud.com";

interface Props {
  slug: string;
  agentName: string;
}

interface LinkConfig {
  label: string;
  icon: string;
  utm_source: string;
  utm_medium: string;
  color: string;
  message?: (url: string, name: string) => string;
}

const CHANNELS: LinkConfig[] = [
  {
    label: "WhatsApp",
    icon: "💬",
    utm_source: "whatsapp",
    utm_medium: "social",
    color: "#25D366",
    message: (url, name) => `Hola! Soy ${name} de EnrollSalud. Cotiza tu seguro de salud gratis aquí: ${url}`,
  },
  {
    label: "SMS",
    icon: "📱",
    utm_source: "sms",
    utm_medium: "sms",
    color: "#3b82f6",
    message: (url, name) => `${name} - Cotiza tu seguro de salud gratis: ${url}`,
  },
  {
    label: "Email",
    icon: "📧",
    utm_source: "email",
    utm_medium: "email",
    color: "#8b5cf6",
  },
  {
    label: "Facebook",
    icon: "👤",
    utm_source: "facebook",
    utm_medium: "social",
    color: "#1877F2",
  },
  {
    label: "Instagram",
    icon: "📸",
    utm_source: "instagram",
    utm_medium: "social",
    color: "#E4405F",
  },
  {
    label: "Link directo",
    icon: "🔗",
    utm_source: "direct",
    utm_medium: "link",
    color: "#10b981",
  },
];

function buildUrl(slug: string, channel: LinkConfig, campaign: string): string {
  const params = new URLSearchParams({
    utm_source: channel.utm_source,
    utm_medium: channel.utm_medium,
    utm_campaign: campaign || "general",
  });
  return `${BASE}/q/${slug}?${params}`;
}

export default function ShareClient({ slug, agentName }: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState("oep-2026");
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const cardStyle: React.CSSProperties = {
    background: "#12141c", borderRadius: 16, padding: 24,
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 14,
    background: "#0e1018", color: "#f0f1f5", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <>
      {/* Back link */}
      <button onClick={() => router.push("/agentes/dashboard")} style={{
        padding: "6px 14px", borderRadius: 8, marginBottom: 20,
        border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
        color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>← Dashboard</button>

      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Compartir Tu Link</h1>
      <p style={{ fontSize: 14, color: "#5a5e72", marginBottom: 24 }}>
        Genera links personalizados para cada canal. Cada lead se rastrea automáticamente.
      </p>

      {/* Campaign name */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Campaña</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={campaign}
            onChange={(e) => setCampaign(e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase())}
            placeholder="nombre-de-campaña"
          />
          <div style={{ display: "flex", gap: 6 }}>
            {["oep-2026", "sep-medicaid", "referidos"].map((c) => (
              <button key={c} onClick={() => setCampaign(c)} style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: campaign === c ? "1.5px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
                background: campaign === c ? "rgba(16,185,129,0.1)" : "transparent",
                color: campaign === c ? "#10b981" : "#5a5e72",
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Channel links */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Links por Canal</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CHANNELS.map((ch) => {
            const url = buildUrl(slug, ch, campaign);
            const isCopied = copied === ch.label;
            return (
              <div key={ch.label} style={{
                background: "#0e1018", borderRadius: 12, padding: "14px 16px",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${ch.color}18`, border: `1px solid ${ch.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>{ch.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f1f5" }}>{ch.label}</div>
                  <div style={{ fontSize: 11, color: "#3a3d4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {url}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => copyToClipboard(url, ch.label)} style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    background: isCopied ? "#10b981" : "rgba(255,255,255,0.08)",
                    color: isCopied ? "#000" : "#8b8fa3",
                    minWidth: 70, transition: "all .2s",
                  }}>{isCopied ? "Copiado!" : "Copiar"}</button>

                  {ch.message && (
                    <button onClick={() => {
                      const msg = ch.message!(url, agentName);
                      if (ch.utm_source === "whatsapp") {
                        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                      } else if (ch.utm_source === "sms") {
                        window.open(`sms:?body=${encodeURIComponent(msg)}`, "_blank");
                      }
                    }} style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      border: `1px solid ${ch.color}40`, background: `${ch.color}15`,
                      color: ch.color, cursor: "pointer", fontFamily: "inherit",
                    }}>Enviar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pre-fill example */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Link con datos pre-llenados</div>
        <p style={{ fontSize: 13, color: "#5a5e72", marginBottom: 12 }}>
          Agrega <code style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: 4 }}>&name=Juan&zip=33914</code> al link para pre-llenar nombre y ZIP.
        </p>
        <div style={{
          background: "#0e1018", borderRadius: 8, padding: "12px 14px",
          fontSize: 12, color: "#8b8fa3", fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.6, wordBreak: "break-all",
        }}>
          {BASE}/q/{slug}?name=Juan&zip=33914&utm_source=whatsapp&utm_medium=social&utm_campaign={campaign}
        </div>
        <p style={{ fontSize: 12, color: "#3a3d4a", marginTop: 8 }}>
          Parámetros: <code>name</code>, <code>zip</code>, <code>phone</code>, <code>email</code>, <code>lang</code> (en/es)
        </p>
      </div>
    </>
  );
}
