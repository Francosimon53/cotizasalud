"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const BASE = "https://www.enrollsalud.com";

interface Props {
  slug: string;
  agentName: string;
}

type UtmPreset = {
  key: string;
  label: string;
  source: string;
  medium: string;
  color: string;
  icon: string;
};

const UTM_PRESETS: UtmPreset[] = [
  { key: "whatsapp", label: "WhatsApp", source: "whatsapp", medium: "social", color: "#25D366", icon: "💬" },
  { key: "facebook", label: "Facebook", source: "facebook", medium: "social", color: "#1877F2", icon: "👤" },
  { key: "instagram", label: "Instagram", source: "instagram", medium: "social", color: "#E4405F", icon: "📸" },
  { key: "tiktok", label: "TikTok", source: "tiktok", medium: "social", color: "#ff0050", icon: "🎵" },
  { key: "email", label: "Email", source: "email", medium: "email", color: "#8b5cf6", icon: "📧" },
  { key: "print", label: "Tarjeta impresa", source: "print", medium: "offline", color: "#f59e0b", icon: "🖨️" },
];

function buildLink(slug: string, clientName: string, preset: UtmPreset | null, campaign: string): string {
  const params = new URLSearchParams();
  if (clientName.trim()) params.set("name", clientName.trim());
  if (preset) {
    params.set("utm_source", preset.source);
    params.set("utm_medium", preset.medium);
    if (campaign) params.set("utm_campaign", campaign);
  }
  const qs = params.toString();
  return `${BASE}/q/${slug}${qs ? `?${qs}` : ""}`;
}

export default function ShareClient({ slug, agentName }: Props) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [campaign, setCampaign] = useState("oep-2026");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const baseLink = useMemo(() => `${BASE}/q/${slug}`, [slug]);
  const personalLink = useMemo(() => {
    const preset = activePreset ? UTM_PRESETS.find((p) => p.key === activePreset) ?? null : null;
    return buildLink(slug, clientName, preset, campaign);
  }, [slug, clientName, activePreset, campaign]);

  // Generate QR whenever baseLink changes
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(baseLink, {
      width: 600,
      margin: 2,
      color: { dark: "#0F172A", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [baseLink]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // noop
    }
  };

  const greetingName = clientName.trim() || "[Nombre]";

  const messages = useMemo(() => ({
    whatsapp: `Hola ${greetingName}! 👋 Soy ${agentName}, tu agente de seguros.\nCotiza tu plan de salud gratis en 2 minutos aquí: ${personalLink}\nCualquier pregunta, escríbeme.`,
    sms: `Cotiza tu seguro de salud gratis: ${personalLink}`,
    emailSig: `¿Necesitas seguro de salud? Cotiza gratis en español: ${personalLink}`,
    social: `💙 ¿Sabías que puedes tener seguro de salud por menos de lo que pagas al mes en café? ☕ Cotiza gratis en español 👉 ${personalLink}`,
    tiktok: `Seguros de salud en español 🏥 Link en bio para cotizar gratis 💚 #SeguroDeSalud #Obamacare #ACA #SaludHispana`,
  }), [agentName, personalLink, greetingName]);

  const openWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(messages.whatsapp)}`, "_blank");
  };
  const openSMS = () => {
    window.location.href = `sms:?&body=${encodeURIComponent(messages.sms)}`;
  };
  const openEmail = () => {
    const subject = "Cotiza tu seguro de salud gratis";
    const body = `Hola ${greetingName},\n\n${messages.emailSig}\n\n— ${agentName}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const downloadQrPdf = () => {
    if (!qrDataUrl) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text("Cotiza tu seguro de salud", W / 2, 30, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text("Escanea con tu teléfono", W / 2, 40, { align: "center" });

    // QR
    const qrSize = 120;
    const qrX = (W - qrSize) / 2;
    const qrY = 55;
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

    // Link under QR
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129);
    doc.text(`enrollsalud.com/q/${slug}`, W / 2, qrY + qrSize + 12, { align: "center" });

    // Agent
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(`Agente: ${agentName}`, W / 2, qrY + qrSize + 22, { align: "center" });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("EnrollSalud — Seguros de salud en español", W / 2, H - 20, { align: "center" });

    doc.save(`QR_${slug}.pdf`);
  };

  // --- styles ---
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
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: 0.6, color: "#8b8fa3", marginBottom: 10,
  };
  const copyBtn = (key: string): React.CSSProperties => ({
    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: "none", cursor: "pointer", fontFamily: "inherit",
    background: copied === key ? "#10b981" : "rgba(16,185,129,0.15)",
    color: copied === key ? "#000" : "#10b981",
    transition: "all .2s", whiteSpace: "nowrap",
  });

  return (
    <>
      {/* Back link */}
      <button onClick={() => router.push("/agentes/dashboard")} style={{
        padding: "6px 14px", borderRadius: 8, marginBottom: 20,
        border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
        color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>← Dashboard</button>

      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>🚀 Tu kit para compartir</h1>
      <p style={{ fontSize: 14, color: "#5a5e72", marginBottom: 24 }}>
        Link personal, QR imprimible, mensajes listos y tracking por canal. Tus leads entran directo a tu dashboard.
      </p>

      {/* 1. SMART LINK HERO */}
      <div style={{
        ...cardStyle,
        background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))",
        border: "1px solid rgba(16,185,129,0.3)",
      }}>
        <div style={sectionLabel}>Tu link personal</div>
        <div style={{
          fontSize: 22, fontWeight: 900, color: "#10b981",
          wordBreak: "break-all", lineHeight: 1.3, marginBottom: 14,
        }}>
          enrollsalud.com/q/{slug}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => copyToClipboard(baseLink, "hero")} style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
            border: "none", cursor: "pointer", fontFamily: "inherit",
            background: copied === "hero" ? "#10b981" : "#10b981",
            color: "#000", transition: "all .2s",
          }}>
            {copied === "hero" ? "¡Copiado!" : "📋 Copiar link"}
          </button>
          <button onClick={() => window.open(baseLink, "_blank")} style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
            border: "1.5px solid rgba(16,185,129,0.4)", cursor: "pointer", fontFamily: "inherit",
            background: "transparent", color: "#10b981",
          }}>
            🔗 Abrir en pestaña nueva
          </button>
        </div>
      </div>

      {/* 5. CLIENT NAME PERSONALIZATION */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Personalizar para un cliente (opcional)</div>
        <input
          style={inputStyle}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Nombre del cliente — ej. Juan"
        />
        <p style={{ fontSize: 12, color: "#5a5e72", marginTop: 8, marginBottom: 0 }}>
          Cuando escribes un nombre, los mensajes abajo se personalizan y el link incluye <code style={{ color: "#10b981", background: "rgba(16,185,129,0.08)", padding: "1px 6px", borderRadius: 4 }}>?name={clientName || "Juan"}</code> para pre-llenar el formulario.
        </p>
      </div>

      {/* 6. UTM TRACKING PRESETS */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Link con tracking por canal</div>
        <p style={{ fontSize: 13, color: "#8b8fa3", marginTop: -4, marginBottom: 12 }}>
          Usa un link distinto por canal para ver cuál te trae más clientes.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginBottom: 14 }}>
          {UTM_PRESETS.map((p) => {
            const active = activePreset === p.key;
            return (
              <button key={p.key} onClick={() => setActivePreset(active ? null : p.key)} style={{
                padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                border: active ? `1.5px solid ${p.color}` : "1px solid rgba(255,255,255,0.1)",
                background: active ? `${p.color}18` : "transparent",
                color: active ? p.color : "#8b8fa3",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                display: "flex", alignItems: "center", gap: 8,
                transition: "all .2s",
              }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <span>Link para {p.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: "#5a5e72", marginBottom: 6 }}>Campaña (opcional)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            style={{ ...inputStyle, flex: "1 1 160px", minWidth: 120 }}
            value={campaign}
            onChange={(e) => setCampaign(e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase())}
            placeholder="oep-2026"
          />
          {["oep-2026", "sep-medicaid", "referidos"].map((c) => (
            <button key={c} onClick={() => setCampaign(c)} style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: campaign === c ? "1.5px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
              background: campaign === c ? "rgba(16,185,129,0.1)" : "transparent",
              color: campaign === c ? "#10b981" : "#8b8fa3",
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>{c}</button>
          ))}
        </div>

        <div style={{
          background: "#0e1018", borderRadius: 10, padding: "14px 16px",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <div style={{
            flex: 1, minWidth: 200, fontSize: 12, color: "#8b8fa3",
            fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all",
          }}>
            {personalLink}
          </div>
          <button onClick={() => copyToClipboard(personalLink, "personal")} style={copyBtn("personal")}>
            {copied === "personal" ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
      </div>

      {/* 4. DIRECT SHARE BUTTONS */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Compartir con un toque</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          <button onClick={openWhatsApp} style={{
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "#25D366", color: "#000", fontSize: 13, fontWeight: 800,
            fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>💬 WhatsApp</button>
          <button onClick={openSMS} style={{
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 800,
            fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>📱 SMS</button>
          <button onClick={openEmail} style={{
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "#8b5cf6", color: "#fff", fontSize: 13, fontWeight: 800,
            fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>📧 Email</button>
          <button onClick={() => copyToClipboard(personalLink, "share-copy")} style={{
            padding: "12px 14px", borderRadius: 10, border: "1.5px solid rgba(16,185,129,0.4)", cursor: "pointer",
            background: copied === "share-copy" ? "#10b981" : "transparent",
            color: copied === "share-copy" ? "#000" : "#10b981",
            fontSize: 13, fontWeight: 800, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s",
          }}>{copied === "share-copy" ? "¡Copiado!" : "🔗 Copiar link"}</button>
        </div>
      </div>

      {/* 3. PRE-WRITTEN MESSAGES */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Mensajes listos para copiar</div>

        {([
          { key: "whatsapp", label: "💬 WhatsApp", text: messages.whatsapp, color: "#25D366" },
          { key: "sms", label: "📱 SMS (corto)", text: messages.sms, color: "#3b82f6" },
          { key: "emailSig", label: "📧 Firma de email", text: messages.emailSig, color: "#8b5cf6" },
          { key: "social", label: "👤 Facebook / Instagram", text: messages.social, color: "#1877F2" },
          { key: "tiktok", label: "🎵 Caption de TikTok", text: messages.tiktok, color: "#ff0050" },
        ] as const).map((m) => (
          <div key={m.key} style={{
            background: "#0e1018", borderRadius: 12, padding: "14px 16px",
            border: `1px solid ${m.color}25`, marginBottom: 10,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", gap: 10, marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.label}</div>
              <button onClick={() => copyToClipboard(m.text, m.key)} style={copyBtn(m.key)}>
                {copied === m.key ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
            <div style={{
              fontSize: 13, color: "#c8ccd6", whiteSpace: "pre-wrap",
              lineHeight: 1.5, fontFamily: "inherit",
            }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* 2. QR CODE */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Código QR imprimible</div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 14,
            width: 300, height: 300, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code" width={272} height={272} style={{ display: "block" }} />
            ) : (
              <div style={{ color: "#64748b", fontSize: 12 }}>Generando…</div>
            )}
            <canvas ref={qrCanvasRef} style={{ display: "none" }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 13, color: "#c8ccd6", marginTop: 0, lineHeight: 1.5 }}>
              Imprímelo en tarjetas de presentación, flyers o pégalo en tu vitrina. Cuando un cliente lo escanee, llega directo a tu cotizador.
            </p>
            <button onClick={downloadQrPdf} disabled={!qrDataUrl} style={{
              padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 800,
              border: "none", cursor: qrDataUrl ? "pointer" : "not-allowed",
              background: qrDataUrl ? "#10b981" : "rgba(255,255,255,0.08)",
              color: qrDataUrl ? "#000" : "#5a5e72",
              fontFamily: "inherit", marginTop: 8,
            }}>⬇️ Descargar PDF imprimible</button>
          </div>
        </div>
      </div>
    </>
  );
}
