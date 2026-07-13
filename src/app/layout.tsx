import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  metadataBase: new URL("https://enrollsalud.com"),
  alternates: {
    canonical: "/",
  },
  title: "EnrollSalud | Cotiza tu seguro médico ACA en español",
  description: "Cotiza tu seguro médico ACA en español y calcula tu subsidio en minutos — los mismos planes de Healthcare.gov, con un agente que te ayuda en tu idioma.",
  openGraph: {
    title: "EnrollSalud | Cotiza tu seguro médico ACA en español",
    description: "Cotiza tu seguro médico ACA en español y calcula tu subsidio en minutos — los mismos planes de Healthcare.gov, con un agente que te ayuda en tu idioma.",
    url: "https://enrollsalud.com",
    siteName: "EnrollSalud",
    type: "website",
    locale: "es_US",
  },
  twitter: {
    card: "summary",
    title: "EnrollSalud | Cotiza tu seguro médico ACA en español",
    description: "Cotiza tu seguro médico ACA en español y calcula tu subsidio en minutos — los mismos planes de Healthcare.gov, con un agente que te ayuda en tu idioma.",
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
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,800,900&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}<Analytics /><SpeedInsights /></body>
    </html>
  );
}
