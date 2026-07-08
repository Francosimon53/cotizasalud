import type { ReactNode } from "react";

// Default metadata for the public /agentes landing (B2B / agent audience).
// Subroutes (dashboard, registro, share, …) inherit this unless they export
// their own metadata, which would override it — the correct precedence.
export const metadata = {
  title: "EnrollSalud para Agentes | Cotizador ACA con tu marca + CRM",
  description: "Cotizador ACA bilingüe con planes reales del Marketplace, CRM de leads y consentimiento CMS con firma digital. La plataforma del agente de salud hispano.",
  openGraph: {
    title: "EnrollSalud para Agentes | Cotizador ACA con tu marca + CRM",
    description: "Cotizador ACA bilingüe con planes reales del Marketplace, CRM de leads y consentimiento CMS con firma digital. La plataforma del agente de salud hispano.",
    url: "https://enrollsalud.com/agentes",
    siteName: "EnrollSalud",
    type: "website",
    locale: "es_US",
  },
  twitter: {
    card: "summary",
    title: "EnrollSalud para Agentes | Cotizador ACA con tu marca + CRM",
    description: "Cotizador ACA bilingüe con planes reales del Marketplace, CRM de leads y consentimiento CMS con firma digital. La plataforma del agente de salud hispano.",
  },
};

export default function AgentesLayout({ children }: { children: ReactNode }) {
  return children;
}
