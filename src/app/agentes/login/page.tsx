"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase-auth";
import "../agentes.css";

export default function AgentLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createBrowserAuthClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setLoading(false);
      return;
    }

    router.push("/agentes/dashboard");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Ingresa tu correo electrónico"); return; }
    setError("");
    setLoading(true);

    const supabase = createBrowserAuthClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://www.enrollsalud.com/agentes/login",
    });

    if (resetError) {
      setError("Error al enviar el correo. Intenta de nuevo.");
    } else {
      setSuccess("Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja.");
    }
    setLoading(false);
  };

  return (
    <div style={{
      fontFamily: "'Satoshi', -apple-system, sans-serif",
      minHeight: "100vh",
      background: "#08090d",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #10b981, #06b6d4)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 900, color: "#000", marginBottom: 12,
          }}>ES</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f1f5", letterSpacing: -0.5 }}>
            EnrollSalud
          </div>
          <div style={{ fontSize: 13, color: "#5a5e72", marginTop: 4 }}>
            Portal de Agentes
          </div>
        </div>

        {/* Card */}
        <form onSubmit={resetMode ? handleReset : handleSubmit} style={{
          background: "#12141c",
          borderRadius: 16,
          padding: 32,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f0f1f5", marginBottom: 4 }}>
            {resetMode ? "Restablecer Contraseña" : "Iniciar Sesión"}
          </h1>
          <p style={{ fontSize: 13, color: "#5a5e72", marginBottom: 24 }}>
            {resetMode ? "Te enviaremos un correo para restablecer tu contraseña" : "Accede a tu panel de agente"}
          </p>

          {error && (
            <div role="alert" style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#ef4444",
            }}>{error}</div>
          )}
          {success && (
            <div style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#10b981",
            }}>{success}</div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-email" style={{
              display: "block", fontSize: 12, fontWeight: 700, color: "#8b8fa3",
              textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
            }}>Correo electrónico</label>
            <input id="login-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="agente@ejemplo.com" autoFocus
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#0e1018", color: "#f0f1f5" }} />
          </div>

          {!resetMode && (
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="login-password" style={{
                display: "block", fontSize: 12, fontWeight: 700, color: "#8b8fa3",
                textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
              }}>Contraseña</label>
              <input id="login-password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#0e1018", color: "#f0f1f5" }} />
            </div>
          )}

          {!resetMode && (
            <div style={{ textAlign: "right", marginBottom: 20 }}>
              <button type="button" onClick={() => { setResetMode(true); setError(""); setSuccess(""); }}
                style={{ background: "none", border: "none", color: "#5a5e72", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", padding: "14px 28px", borderRadius: 10, border: "none", fontSize: 16, fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              background: loading ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #06b6d4)",
              color: loading ? "#5a5e72" : "#000", transition: "all .2s",
            }}>
            {loading ? "..." : resetMode ? "Enviar Correo" : "Iniciar Sesión"}
          </button>

          {resetMode && (
            <button type="button" onClick={() => { setResetMode(false); setError(""); setSuccess(""); }}
              style={{ width: "100%", padding: "12px", marginTop: 10, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#8b8fa3", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Volver a Iniciar Sesión
            </button>
          )}
        </form>

        {/* Register + Back links */}
        {!resetMode && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <a href="/agentes/registro" style={{ fontSize: 14, color: "#10b981", textDecoration: "none", fontWeight: 700 }}>
              Crear Cuenta de Agente →
            </a>
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a href="/agentes" style={{ fontSize: 13, color: "#5a5e72", textDecoration: "none" }}>
            ← Volver a EnrollSalud
          </a>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 40, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/privacy" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Privacidad</a>
          <a href="/terms" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Términos</a>
          <a href="/compliance" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Cumplimiento</a>
          <a href="mailto:info@enrollsalud.com" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Contacto</a>
        </div>
      </div>
    </div>
  );
}
