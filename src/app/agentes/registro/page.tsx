"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase-auth";
import "../agentes.css";

export default function AgentRegistroPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const supabase = createBrowserAuthClient();

    // Sign up
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: "https://www.enrollsalud.com/agentes/dashboard" },
    });

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        setError("Este correo ya está registrado. ¿Quieres iniciar sesión?");
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    // Create agent record via API
    await fetch("/api/auth/register", { method: "POST" });

    // Redirect to profile to complete setup
    router.push("/agentes/dashboard/profile");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 8,
    border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 15,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    background: "#0e1018", color: "#f0f1f5",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: "#8b8fa3",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
  };

  return (
    <div style={{
      fontFamily: "'Satoshi', -apple-system, sans-serif",
      minHeight: "100vh", background: "#08090d",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
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
        <form onSubmit={handleSubmit} style={{
          background: "#12141c", borderRadius: 16, padding: 32,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f0f1f5", marginBottom: 4 }}>
            Crear Cuenta
          </h1>
          <p style={{ fontSize: 13, color: "#5a5e72", marginBottom: 24 }}>
            Regístrate gratis y configura tu cotizador en minutos
          </p>

          {error && (
            <div role="alert" style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#ef4444",
            }}>{error}</div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="reg-email" style={labelStyle}>Correo electrónico</label>
            <input id="reg-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="agente@ejemplo.com" autoFocus
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="reg-password" style={labelStyle}>Contraseña</label>
            <input id="reg-password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="reg-confirm" style={labelStyle}>Confirmar contraseña</label>
            <input id="reg-confirm" type="password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Repite tu contraseña"
              style={inputStyle} />
          </div>

          <button type="submit" disabled={loading}
            style={{
              width: "100%", padding: "14px 28px", borderRadius: 10, border: "none",
              fontSize: 16, fontWeight: 800, fontFamily: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #06b6d4)",
              color: loading ? "#5a5e72" : "#000", transition: "all .2s",
            }}>
            {loading ? "Creando cuenta..." : "Crear Cuenta"}
          </button>

          <p style={{ fontSize: 11, color: "#3a3d4a", marginTop: 12, lineHeight: 1.5, textAlign: "center" }}>
            Al crear tu cuenta aceptas nuestros <a href="/terms" style={{ color: "#5a5e72" }}>Términos</a> y <a href="/privacy" style={{ color: "#5a5e72" }}>Privacidad</a>
          </p>
        </form>

        {/* Login link */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <span style={{ fontSize: 13, color: "#5a5e72" }}>¿Ya tienes cuenta? </span>
          <a href="/agentes/login" style={{ fontSize: 13, color: "#10b981", textDecoration: "none", fontWeight: 700 }}>
            Iniciar Sesión
          </a>
        </div>
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
