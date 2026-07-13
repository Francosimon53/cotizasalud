import type { MetadataRoute } from "next";

// Crawlers de IA verificados a julio 2026 (respetar mayúsculas).
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Amazonbot",
  "DuckAssistBot",
  "MistralAI-User",
  "CCBot",
];

const DISALLOWED = ["/api/", "/agentes/dashboard/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED,
      },
      // Un grupo específico ignora el grupo `*`: los crawlers de IA deben
      // repetir los mismos disallows o quedarían con acceso a /api/ y al dashboard.
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
        disallow: DISALLOWED,
      },
    ],
    sitemap: "https://enrollsalud.com/sitemap.xml",
  };
}
