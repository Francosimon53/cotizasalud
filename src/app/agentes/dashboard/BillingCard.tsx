import Link from "next/link";
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

const NEXT_TIER: Partial<Record<SubscriptionPlan, "basic" | "pro" | "advanced">> = {
  trial: "pro",
  legacy_early_adopter: "pro",
  basic: "pro",
  pro: "advanced",
  // advanced: no upgrade target — they manage via portal.
};

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; color: string }> = {
  active: { label: "Activa", color: "#10b981" },
  trialing: { label: "En prueba", color: "#06b6d4" },
  past_due: { label: "Pago pendiente", color: "#f59e0b" },
  canceled: { label: "Cancelada", color: "#ef4444" },
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const PRIMARY_BTN = {
  background: "#10b981",
  color: "#0F172A",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontWeight: 800,
  fontSize: 13,
} as const;

const SECONDARY_BTN = {
  background: "transparent",
  color: "#E2E8F0",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: "10px 18px",
  fontWeight: 700,
  fontSize: 13,
} as const;

export default function BillingCard(props: Props) {
  const planLabel = SUBSCRIPTION_PLANS[props.plan].name;
  const upgradeTarget = NEXT_TIER[props.plan] ?? null;
  const usagePct =
    props.leadsLimit > 0 ? Math.min(100, Math.round((props.leadsCurrent / props.leadsLimit) * 100)) : 0;
  const usageColor = usagePct >= 90 ? "#ef4444" : usagePct >= 70 ? "#f59e0b" : "#10b981";
  const statusInfo = STATUS_BADGE[props.status];

  const trialDaysLeft = props.plan === "trial" ? daysUntil(props.trialEndDate) : null;
  const graceDaysLeft = props.plan === "legacy_early_adopter" ? daysUntil(props.legacyGracePeriodUntil) : null;
  const countdown =
    trialDaysLeft !== null
      ? { label: "Termina la prueba en", days: trialDaysLeft }
      : graceDaysLeft !== null
      ? { label: "Período Early Adopter termina en", days: graceDaysLeft }
      : null;

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: "#94A3B8",
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
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
            {planLabel}
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
          {countdown && (
            <div
              style={{
                fontSize: 12,
                color: countdown.days <= 3 ? "#ef4444" : "#94A3B8",
                marginTop: 6,
              }}
            >
              {countdown.label}: <strong>{countdown.days} {countdown.days === 1 ? "día" : "días"}</strong>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {upgradeTarget && (
            <CheckoutButton
              plan={upgradeTarget}
              label={`Upgrade a ${SUBSCRIPTION_PLANS[upgradeTarget].name}`}
              style={PRIMARY_BTN}
            />
          )}
          {!upgradeTarget && (
            <Link
              href="/agentes#precios"
              style={{ ...SECONDARY_BTN, textDecoration: "none", display: "inline-block" }}
            >
              Ver planes
            </Link>
          )}
          {props.hasStripeCustomer && (
            <PortalButton label="Administrar pago" style={SECONDARY_BTN} />
          )}
        </div>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#94A3B8",
            marginBottom: 6,
          }}
        >
          <span>Leads usados este mes</span>
          <span style={{ fontWeight: 800, color: "#E2E8F0" }}>
            {props.leadsCurrent} / {props.leadsLimit}
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: "#0F172A",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${usagePct}%`,
              height: "100%",
              background: usageColor,
              transition: "width 200ms",
            }}
          />
        </div>
      </div>
    </div>
  );
}
