import { SUBSCRIPTION_PLANS, type SubscriptionPlan, type SubscriptionStatus } from "@/lib/subscription-plans";
import { CheckoutButton, PortalButton } from "../StripeButtons";

interface Props {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  leadsCurrent: number;
  leadsLimit: number;
  trialEndDate: string | null;
  legacyGracePeriodUntil: string | null;
  hasStripeCustomer: boolean;
}

type PaidPlan = "basic" | "pro" | "advanced";
const ALL_PAID_PLANS: readonly PaidPlan[] = ["basic", "pro", "advanced"] as const;

const PLAN_FEATURES: Record<PaidPlan, string[]> = {
  basic: [
    "Hasta 50 leads/mes",
    "Dashboard + página compartible",
    "Exportación CSV",
  ],
  pro: [
    "Hasta 200 leads/mes",
    "Notificaciones WhatsApp",
    "AI Advisor + reportes",
  ],
  advanced: [
    "Hasta 500 leads/mes",
    "Múltiples agentes",
    "Importación masiva + renovaciones",
  ],
};

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; color: string }> = {
  active: { label: "Activa", color: "#10b981" },
  trialing: { label: "En prueba", color: "#06b6d4" },
  past_due: { label: "Pago pendiente", color: "#f59e0b" },
  canceled: { label: "Cancelada", color: "#ef4444" },
};

const ACCENT = "#10b981";
const CYAN = "#06b6d4";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function formatDateEs(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// The plan whose mini-card should be highlighted as "current" (or null = no highlight, e.g. plain trial).
function effectivePlanForHighlight(plan: SubscriptionPlan): PaidPlan | null {
  if (plan === "basic" || plan === "pro" || plan === "advanced") return plan;
  if (plan === "legacy_early_adopter") return "pro";
  return null;
}

export default function BillingCard(props: Props) {
  const usagePct = props.leadsLimit > 0 ? Math.min(100, Math.round((props.leadsCurrent / props.leadsLimit) * 100)) : 0;
  const usageColor = usagePct >= 90 ? "#ef4444" : usagePct >= 70 ? "#f59e0b" : ACCENT;
  const statusInfo = STATUS_BADGE[props.status];
  const highlightedPlan = effectivePlanForHighlight(props.plan);
  const isLegacy = props.plan === "legacy_early_adopter";
  const trialDaysLeft = props.plan === "trial" ? daysUntil(props.trialEndDate) : null;
  const graceEndDate = formatDateEs(props.legacyGracePeriodUntil);

  return (
    <div
      style={{
        background: "#1E293B",
        borderRadius: 16,
        padding: 24,
        border: "1px solid #334155",
        marginBottom: 20,
      }}
    >
      {/* Header: current plan + status + leads usage */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr minmax(200px, 280px)",
          gap: 24,
          alignItems: "start",
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>
            Plan actual
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#E2E8F0",
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {SUBSCRIPTION_PLANS[props.plan].name}
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "3px 10px",
                borderRadius: 999,
                background: statusInfo.color + "22",
                color: statusInfo.color,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {statusInfo.label}
            </span>
          </div>
          {trialDaysLeft !== null && (
            <div style={{ fontSize: 12, color: trialDaysLeft <= 3 ? "#ef4444" : "#94A3B8", marginTop: 6 }}>
              Termina la prueba en{" "}
              <strong>
                {trialDaysLeft} {trialDaysLeft === 1 ? "día" : "días"}
              </strong>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8", marginBottom: 6 }}>
            <span>Leads este mes</span>
            <span style={{ fontWeight: 800, color: "#E2E8F0" }}>
              {props.leadsCurrent} / {props.leadsLimit}
            </span>
          </div>
          <div style={{ height: 8, background: "#0F172A", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${usagePct}%`, height: "100%", background: usageColor, transition: "width 200ms" }} />
          </div>
        </div>
      </div>

      {/* Legacy Early Adopter banner */}
      {isLegacy && (
        <div
          style={{
            background: "rgba(6, 182, 212, 0.10)",
            border: "1px solid rgba(6, 182, 212, 0.35)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: CYAN,
            lineHeight: 1.5,
          }}
        >
          🎁 <strong>Estás en período Early Adopter</strong> — Pro gratis
          {graceEndDate && ` hasta el ${graceEndDate}`}. Después podés elegir el plan que prefieras.
          Si querés cambiar antes, podés hacerlo desde aquí.
        </div>
      )}

      {/* 3 plan mini-cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: props.hasStripeCustomer ? 16 : 0,
        }}
      >
        {ALL_PAID_PLANS.map((p) => {
          const planData = SUBSCRIPTION_PLANS[p];
          const isCurrent = highlightedPlan === p;
          return (
            <PlanMiniCard
              key={p}
              planId={p}
              name={planData.name}
              priceUsd={planData.price_usd}
              leadsLimit={planData.leads_limit}
              features={PLAN_FEATURES[p]}
              isCurrent={isCurrent}
              isLegacy={isLegacy}
            />
          );
        })}
      </div>

      {/* Manage payment button (below the cards, centered) */}
      {props.hasStripeCustomer && (
        <div style={{ textAlign: "center" }}>
          <PortalButton
            label="Administrar pago"
            style={{
              background: "transparent",
              color: "#94A3B8",
              border: "1px solid #334155",
              borderRadius: 10,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 13,
            }}
          />
        </div>
      )}
    </div>
  );
}

interface PlanMiniCardProps {
  planId: PaidPlan;
  name: string;
  priceUsd: number;
  leadsLimit: number;
  features: string[];
  isCurrent: boolean;
  isLegacy: boolean;
}

function PlanMiniCard(props: PlanMiniCardProps) {
  return (
    <div
      style={{
        background: "#0F172A",
        border: props.isCurrent ? `2px solid ${ACCENT}` : "1px solid #334155",
        borderRadius: 12,
        padding: 16,
        position: "relative",
        boxShadow: props.isCurrent ? "0 0 0 4px rgba(16, 185, 129, 0.10)" : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {props.isCurrent && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 12,
            background: ACCENT,
            color: "#0F172A",
            fontSize: 10,
            fontWeight: 800,
            padding: "3px 10px",
            borderRadius: 999,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          {props.isLegacy ? "Tu plan durante Early Adopter" : "Tu plan actual"}
        </div>
      )}

      <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {props.name}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: "#E2E8F0", letterSpacing: -0.5 }}>${props.priceUsd}</span>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>/mes</span>
      </div>
      <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, marginTop: 2, marginBottom: 12 }}>
        {props.leadsLimit} leads/mes
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {props.features.map((f) => (
          <li key={f} style={{ fontSize: 12, color: "#E2E8F0", display: "flex", gap: 6, lineHeight: 1.4 }}>
            <span style={{ color: ACCENT, fontWeight: 800, flexShrink: 0 }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 14 }}>
        {props.isCurrent ? (
          <button
            type="button"
            disabled
            style={{
              width: "100%",
              background: "rgba(16, 185, 129, 0.15)",
              color: ACCENT,
              border: `1px solid ${ACCENT}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              fontSize: 12,
              cursor: "not-allowed",
            }}
          >
            ✓ Plan actual
          </button>
        ) : (
          <CheckoutButton
            plan={props.planId}
            label={`Cambiar a ${props.name}`}
            style={{
              width: "100%",
              background: "transparent",
              color: "#E2E8F0",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              fontSize: 12,
            }}
          />
        )}
      </div>
    </div>
  );
}
