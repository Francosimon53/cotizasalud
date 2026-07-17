"use client";

import { useEffect } from "react";
import { captureSuscripcionActivada } from "@/lib/analytics";

// Rendered only when the dashboard is loaded via Stripe's success_url
// (?checkout=success). Dedupes per Stripe Checkout session so a page refresh
// doesn't double-count the activation. The session id itself is never sent
// as an event property.
export default function CheckoutSuccessTracker({ sessionId }: { sessionId?: string }) {
  useEffect(() => {
    const key = `es_sub_activada_${sessionId ?? "unknown"}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    captureSuscripcionActivada();
  }, [sessionId]);

  return null;
}
