"use client";

import { useState, type CSSProperties } from "react";

interface CheckoutButtonProps {
  plan: "basic" | "pro" | "advanced";
  label: string;
  style?: CSSProperties;
  className?: string;
}

export function CheckoutButton({ plan, label, style, className }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || `Error iniciando el pago (HTTP ${res.status})`);
      }
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error iniciando el pago";
      alert(msg);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
      style={{ cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, ...style }}
    >
      {loading ? "Cargando…" : label}
    </button>
  );
}

interface PortalButtonProps {
  label: string;
  style?: CSSProperties;
  className?: string;
}

export function PortalButton({ label, style, className }: PortalButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || `Error abriendo el portal (HTTP ${res.status})`);
      }
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error abriendo el portal";
      alert(msg);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
      style={{ cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, ...style }}
    >
      {loading ? "Cargando…" : label}
    </button>
  );
}
