import type { ReactNode } from "react";
import Link from "next/link";
import "./recursos.css";

// Metadata por defecto del blog /recursos. Las páginas de artículo exportan
// la suya propia (title, description, canonical) y la sobreescriben.
export const metadata = {
  alternates: {
    canonical: "/recursos",
  },
  title: "Recursos para agentes ACA | EnrollSalud",
  description: "Guías en español para agentes de salud hispanos: elegibilidad ACA, cambios de subsidios, herramientas de captura de leads y preparación para el OEP.",
  openGraph: {
    title: "Recursos para agentes ACA | EnrollSalud",
    description: "Guías en español para agentes de salud hispanos: elegibilidad ACA, cambios de subsidios, herramientas de captura de leads y preparación para el OEP.",
    url: "https://enrollsalud.com/recursos",
    siteName: "EnrollSalud",
    type: "website",
    locale: "es_US",
  },
  twitter: {
    card: "summary",
    title: "Recursos para agentes ACA | EnrollSalud",
    description: "Guías en español para agentes de salud hispanos: elegibilidad ACA, cambios de subsidios, herramientas de captura de leads y preparación para el OEP.",
  },
};

export default function RecursosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="rec-shell">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Satoshi:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap"
      />
      <nav className="rec-nav">
        <Link href="/" className="rec-nav-brand">Enroll<span>Salud</span></Link>
        <div className="rec-nav-links">
          <Link href="/recursos">Recursos</Link>
          <Link href="/agentes">Para agentes</Link>
          <Link href="/cotizar" className="rec-nav-cta">Cotizar gratis</Link>
        </div>
      </nav>
      {children}
      <footer className="rec-footer">
        <Link href="/" className="rec-footer-brand">Enroll<span>Salud</span></Link>
        <div className="rec-footer-links">
          <Link href="/">Inicio</Link>
          <Link href="/agentes">Para agentes</Link>
          <Link href="/terms">Términos</Link>
          <Link href="/privacy">Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
