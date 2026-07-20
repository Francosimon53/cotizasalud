# Runbook — Bloque 3 · Guión 1: página CRM para agentes de Obamacare

**Fecha:** 2026-07-20 · **Rama:** `feat/seo-crm-agentes-obamacare` · **PR:** [#60](https://github.com/Francosimon53/cotizasalud/pull/60)

## Objetivo

Página pública de intención de compra en `/crm-para-agentes-de-obamacare` (SEO Bloque 3):
dolor primero (OEP corto, pago de bolsillo), contraste CRM genérico vs CRM ACA, features
reales, encaje complementario con HealthSherpa, precios y FAQ con JSON-LD. Resultado
medible: la ruta responde 200 en build de producción con canonical, H1 objetivo y FAQPage
espejado 1:1, y queda registrada en sitemap y llms.txt con enlaces entrantes.

## Hallazgos del PASO 0 que condicionaron la implementación

Replicables en los Guiones 2–4:

- **Metadata estática + canonical relativo.** No hay `generateMetadata` en ninguna página
  pública: todo es `export const metadata`. El root layout define
  `metadataBase: new URL("https://enrollsalud.com")`; cada página/layout declara
  `alternates.canonical` con ruta relativa (`/agentes`, `/recursos/<slug>`) y OG/Twitter
  espejados. Si la página es client component, el metadata vive en su `layout.tsx`
  (patrón /agentes); si es server component, va en el propio `page.tsx` (patrón artículos).
- **JSON-LD inline con escape, sin componente compartido.** Patrón:
  `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />`.
  El FAQPage debe espejar 1:1 el FAQ visible (mismo array `faqs` alimenta ambos).
- **PricingSection es reutilizable tal cual.** `src/app/agentes/PricingSection.tsx` no
  depende de `agentes.css` (estilos inline, fondo propio), no recibe props, trae su propio
  `id="precios"` y dispara `plan_cta_click` vía `src/lib/analytics.ts` (no-op sin PostHog key).
- **`ag-reveal` descartado en páginas server.** Esa clase deja el contenido en `opacity: 0`
  hasta que el IntersectionObserver de `/agentes/page.tsx` (client) lo revela. Una página
  server component sin ese JS quedaría invisible: usar todas las demás clases `ag-*`
  (nav, hero, triage, bento, stats-bar, faq, cta, footer) pero nunca `ag-reveal`.
- **Cifras ACA inline → nace `ACA_STATS`.** Las cifras 26/58/114% vivían como strings
  repetidos en `/` (page.tsx) y `public/llms.txt`. Se creó `src/lib/aca-stats.ts` como
  narrativa canónica; toda página nueva cita desde ahí. Las páginas existentes NO se
  migraron (copy ya publicado).
- **Alta de rutas nuevas: 4 puntos manuales.** `sitemap.ts` (entrada en el array),
  `public/llms.txt` (línea en Páginas principales), enlaces entrantes (footers/nav/artículos)
  y — solo para artículos de blog — `recursos/articles.ts` (índice + sitemap automáticos).
- **Sin colisiones**: los rewrites (`/srx/*` PostHog) y `vercel.json` (solo crons) no chocan
  con slugs nuevos en raíz. `/q/[slug]` vive bajo `/q/`.

## Decisiones y desviaciones aceptadas

- **Server component** (no client como /agentes): la página no necesita JS — mejor para SEO
  y permite prerender estático (○ en el build). Consecuencia directa: sin `ag-reveal` y sin
  smooth-scroll JS (el ancla `#precios` funciona nativo con `scroll-behavior: smooth` del CSS).
- **Footer espejo del `ag-footer` de /agentes**, incluido "Aviso IA" (se había omitido por
  regla de copy anti-jerga IA; se restauró porque es un enlace legal del sitio, no copy),
  más "Para agentes" y "Recursos" como ajuste de rutas.
- **Fix del copy del trial**: "sin tarjeta de sorpresas" → "no se te cobra nada hasta el
  día 15". Razón: el checkout de Stripe con trial SÍ solicita tarjeta; ninguna frase puede
  implicar lo contrario. Regla para futuros guiones: promesas de billing se redactan contra
  el comportamiento real de Stripe (trial solo en primera suscripción, gateado por
  `stripe_subscription_id`).
- **Reglas de copy aplicadas**: sin testimonios, sin superlativos no verificables, sin jerga
  de IA, cifras solo desde `ACA_STATS`, HealthSherpa siempre complementario (nunca
  competitivo), prohibido usar la eliminación del auto-renewal (2028) como urgencia.

## Gate y verificación runtime

Gate (los tres en verde antes de commitear):

- `npx tsc --noEmit` ✅
- `npm test` ✅ — **239/239 tests, 31/31 archivos** (vitest)
- `npm run build` ✅ — `/crm-para-agentes-de-obamacare` prerenderizada estática (○)

Runtime real (build de producción: `PORT=3111 npm run start`, no dev):

- `curl` a la ruta → **HTTP 200** ✅
- H1 contiene literalmente "CRM para agentes de Obamacare" ✅
- `<link rel="canonical" href="https://enrollsalud.com/crm-para-agentes-de-obamacare">` exacto ✅
- JSON-LD extraído y parseado (python3): `@type == FAQPage`, `mainEntity` con exactamente
  **6 items**, y los 6 `name` comparados uno a uno contra los `<summary>` del HTML —
  **idénticos** ✅
- `/sitemap.xml` contiene `<loc>…/crm-para-agentes-de-obamacare</loc>` ✅
- `/llms.txt` contiene la línea de la página ✅
- Servidor detenido y confirmado (curl posterior falla) ✅

## Commits y PR

- `8f84adf` — feat(lib): constante canónica ACA_STATS para cifras del mercado
- `40352e4` — feat(seo): página CRM para agentes de Obamacare — Bloque 3, Guión 1
  (página, sitemap, llms.txt, enlace en footer de /agentes, párrafo en el artículo
  healthsherpa-crm-captura-leads)
- PR **#60** contra `main`: https://github.com/Francosimon53/cotizasalud/pull/60

## Checklist replicable para Guiones 2–4

1. PASO 0 solo lectura: rutas, patrón metadata, sitemap/llms, componentes reutilizables, colisiones.
2. Rama semántica `feat/seo-<tema>`.
3. Página server component con clases `ag-*` (sin `ag-reveal`), metadata estática + canonical,
   JSON-LD FAQPage espejando el FAQ visible, cifras desde `ACA_STATS`.
4. Alta en `sitemap.ts` + `llms.txt` + ≥2 enlaces entrantes.
5. Gate: tsc + tests + build.
6. Verificación runtime sobre `next start` (200, H1, canonical, JSON-LD parseado, sitemap, llms).
7. Commits semánticos separados (lib vs página), push, PR, runbook.
