import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  metadataBase: new URL("https://enrollsalud.com"),
  alternates: {
    canonical: "/",
  },
  title: "EnrollSalud para Agentes | Cotizador ACA con tu marca + CRM",
  description: "Cotizador ACA bilingüe con planes reales del Marketplace, CRM de leads y consentimiento CMS con firma digital. La plataforma del agente de salud hispano.",
  openGraph: {
    title: "EnrollSalud para Agentes | Cotizador ACA con tu marca + CRM",
    description: "Cotizador ACA bilingüe con planes reales del Marketplace, CRM de leads y consentimiento CMS con firma digital. La plataforma del agente de salud hispano.",
    url: "https://enrollsalud.com/",
    siteName: "EnrollSalud",
    type: "website",
    locale: "es_US",
  },
  twitter: {
    card: "summary",
    title: "EnrollSalud para Agentes | Cotizador ACA con tu marca + CRM",
    description: "Cotizador ACA bilingüe con planes reales del Marketplace, CRM de leads y consentimiento CMS con firma digital. La plataforma del agente de salud hispano.",
  },
  robots: {
    index: true,
    follow: true,
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,800,900&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}<Analytics /><SpeedInsights /></body>
    </html>
  );
}
