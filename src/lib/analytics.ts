import posthog from "posthog-js";
import {
  PLAN_CATALOG,
  type BillingInterval,
  type PlanTier,
} from "@/lib/subscription-plans";

// All helpers are no-ops when NEXT_PUBLIC_POSTHOG_KEY is absent (dark launch):
// posthog.init never runs, so nothing is captured and nothing hits the network.
// Never pass lead/consumer PII (names, emails, phones) as event properties.
function enabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function capturePlanCtaClick(plan: PlanTier, interval: BillingInterval) {
  if (!enabled()) return;
  posthog.capture("plan_cta_click", {
    plan,
    interval,
    precio_usd: PLAN_CATALOG[plan].prices[interval].amount_usd,
  });
}

export function captureCheckoutIniciado(plan: PlanTier, interval: BillingInterval) {
  if (!enabled()) return;
  posthog.capture("checkout_iniciado", { plan, interval });
}

export function captureRegistroCompletado() {
  if (!enabled()) return;
  posthog.capture("registro_completado");
}

export function captureSuscripcionActivada() {
  if (!enabled()) return;
  posthog.capture("suscripcion_activada");
}

// cantidad is a row count only — never lead PII.
export function captureLeadsExportados(cantidad: number) {
  if (!enabled()) return;
  posthog.capture("leads_exportados", { cantidad });
}

// distinct_id is the Supabase auth user id — never an email or a name.
export function identifyAgent(supabaseUserId: string) {
  if (!enabled()) return;
  posthog.identify(supabaseUserId);
}
