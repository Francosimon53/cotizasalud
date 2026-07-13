// Registro central de artículos del blog /recursos.
// Alimenta el índice (/recursos/page.tsx) y el sitemap (src/app/sitemap.ts):
// agregar una entrada aquí publica la tarjeta y la URL en el sitemap automáticamente.
// Cada artículo vive como ruta propia en src/app/recursos/<slug>/page.tsx.

export type Article = {
  slug: string;
  title: string;
  description: string;
  publishedISO: string;
  category: string;
};

export const articles: Article[] = [
  {
    slug: "elegibilidad-subsidio-aca-2027",
    title: "Qué cambia para tus clientes ACA en 2027: elegibilidad por estatus migratorio",
    description: "Guía para agentes: qué inmigrantes mantienen o pierden el subsidio ACA desde el 1 de enero de 2027, y cómo preparar tu cartera antes del OEP.",
    publishedISO: "2026-07-13",
    category: "Elegibilidad 2027",
  },
  {
    slug: "healthsherpa-crm-captura-leads",
    title: "HealthSherpa + un CRM de captura: cómo dejar de perder leads antes de la inscripción",
    description: "HealthSherpa inscribe; el lead que llega y se enfría antes es el hueco. Cómo capturar y organizar prospectos ACA sin duplicar tu enrollment.",
    publishedISO: "2026-07-13",
    category: "Herramientas del agente",
  },
];

// Helper para el sitemap y otras vistas
export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
