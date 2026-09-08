import type { ReactNode } from "react";

// Metadata B2C (consumidor) que antes vivía en el layout raíz cuando "/" era
// la landing del consumidor. Hoy "/" es la landing de agentes y este copy vive aquí.
export const metadata = {
  alternates: {
    canonical: "/seguro-medico",
  },
  title: "EnrollSalud | Cotiza tu seguro médico ACA en español",
  description: "Cotiza tu seguro médico ACA en español y calcula tu subsidio en minutos — los mismos planes de Healthcare.gov, con un agente que te ayuda en tu idioma.",
  openGraph: {
    title: "EnrollSalud | Cotiza tu seguro médico ACA en español",
    description: "Cotiza tu seguro médico ACA en español y calcula tu subsidio en minutos — los mismos planes de Healthcare.gov, con un agente que te ayuda en tu idioma.",
    url: "https://enrollsalud.com/seguro-medico",
    siteName: "EnrollSalud",
    type: "website",
    locale: "es_US",
  },
  twitter: {
    card: "summary",
    title: "EnrollSalud | Cotiza tu seguro médico ACA en español",
    description: "Cotiza tu seguro médico ACA en español y calcula tu subsidio en minutos — los mismos planes de Healthcare.gov, con un agente que te ayuda en tu idioma.",
  },
};

export default function SeguroMedicoLayout({ children }: { children: ReactNode }) {
  return children;
}
