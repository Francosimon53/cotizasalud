import Link from "next/link";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

const FEATURES: Record<"basic" | "pro" | "advanced", string[]> = {
  basic: [
    "Hasta 50 leads por mes",
    "Dashboard completo con pipeline",
    "Página pública compartible",
    "Exportación a CSV",
    "Soporte por email",
  ],
  pro: [
    "Hasta 200 leads por mes",
    "Todo lo del plan Básico",
    "Notificaciones automáticas por WhatsApp",
    "AI Advisor para explicar planes",
    "Reportes y métricas avanzadas",
    "Soporte prioritario",
  ],
  advanced: [
    "Hasta 500 leads por mes",
    "Todo lo del plan Pro",
    "Múltiples agentes en una agencia",
    "Importación masiva de leads",
    "Recordatorios de renovación automáticos",
    "Soporte dedicado",
  ],
};

const CARDS = [
  { id: "basic" as const, popular: false },
  { id: "pro" as const, popular: true },
  { id: "advanced" as const, popular: false },
];

const ACCENT = "#10b981";
const PANEL = "#1E293B";
const BORDER = "#334155";
const MUTED = "#94A3B8";
const TEXT = "#E2E8F0";

export default function PricingSection() {
  return (
    <section
      id="precios"
      style={{
        padding: "80px 24px",
        background: "#0F172A",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 12,
            color: ACCENT,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          💎 Precios para agentes
        </div>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: TEXT,
            textAlign: "center",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Elige el plan que crece con tu cartera
        </h2>
        <p
          style={{
            fontSize: 16,
            color: MUTED,
            textAlign: "center",
            maxWidth: 640,
            margin: "16px auto 48px",
            lineHeight: 1.5,
          }}
        >
          Empezás con <strong style={{ color: TEXT }}>14 días de prueba gratis</strong> con los límites del plan
          Pro (200 leads). Después elegís el plan que mejor se ajuste a tu volumen. Sin permanencia.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            maxWidth: 1080,
            margin: "0 auto",
          }}
        >
          {CARDS.map(({ id, popular }) => {
            const plan = SUBSCRIPTION_PLANS[id];
            return (
              <div
                key={id}
                style={{
                  background: PANEL,
                  borderRadius: 16,
                  padding: 28,
                  border: popular ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: popular ? `0 12px 40px rgba(16, 185, 129, 0.18)` : "none",
                }}
              >
                {popular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: ACCENT,
                      color: "#0F172A",
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "4px 12px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Más popular
                  </div>
                )}

                <div
                  style={{
                    fontSize: 13,
                    color: MUTED,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {plan.name}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 8 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: TEXT, letterSpacing: -1 }}>
                    ${plan.price_usd}
                  </span>
                  <span style={{ fontSize: 16, color: MUTED }}>/mes</span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: ACCENT,
                    fontWeight: 700,
                    marginTop: 4,
                    marginBottom: 24,
                  }}
                >
                  Hasta {plan.leads_limit} leads/mes
                </div>

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {FEATURES[id].map((feature) => (
                    <li
                      key={feature}
                      style={{
                        fontSize: 14,
                        color: TEXT,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: ACCENT, fontWeight: 800, flexShrink: 0 }}>✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/agentes/registro"
                  style={{
                    display: "block",
                    textAlign: "center",
                    marginTop: 28,
                    padding: "14px 20px",
                    borderRadius: 12,
                    background: popular ? ACCENT : "transparent",
                    color: popular ? "#0F172A" : TEXT,
                    border: popular ? "none" : `1px solid ${BORDER}`,
                    fontWeight: 800,
                    fontSize: 14,
                    textDecoration: "none",
                    transition: "transform 150ms",
                  }}
                >
                  Empezar prueba gratis →
                </Link>
              </div>
            );
          })}
        </div>

        <p
          style={{
            fontSize: 12,
            color: MUTED,
            textAlign: "center",
            marginTop: 32,
          }}
        >
          Sin permanencia. Cancelá cuando quieras desde el portal de pagos.
        </p>
      </div>
    </section>
  );
}
