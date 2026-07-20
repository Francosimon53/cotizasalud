# Runbook — Bloque 3 · Guión 2: artículo "Cómo conseguir clientes de Obamacare"

**Fecha:** 2026-07-20 · **Rama:** `feat/recursos-articulo-clientes-obamacare`

## Objetivo

Tercer artículo de `/recursos`: guía de adquisición para el agente ACA ya licenciado
(`/recursos/como-conseguir-clientes-de-obamacare`), con el smart link de EnrollSalud como
mecanismo central y enlace bidireccional con la página CRM del Guión 1. Resultado medible:
la ruta responde 200 en build de producción con H1 exacto, canonical absoluto y JSON-LD
Article coherente con el registro; la tarjeta aparece en el índice y la URL en el sitemap.

## Hallazgos del PASO 0 que condicionaron el contenido

El artículo solo afirma lo que el código confirma — fact-check por adelantado:

- **Smart link `/q/[slug]`** reusa el cotizador de `/cotizar`; pre-llenado por query params
  `name`/`n`, `zip`/`z`, `phone`/`p`, `email`/`e`, `lang`, más `utm_source/medium/campaign`
  (`src/app/cotizar/page.tsx:22-48`). El slug del agente va en el path.
- **Kit de compartir** (`/agentes/dashboard/share`): 6 presets de canal con UTM (whatsapp,
  facebook, instagram, tiktok, email, print), QR real (librería `qrcode`) con descarga PDF,
  y 5 templates de mensaje en español (WhatsApp, SMS, firma de email, social, TikTok).
  Regla de copy: no citar nombres literales de campañas preset.
- **Notificación de lead nuevo = email, no WhatsApp.** `/api/leads` dispara fire-and-forget
  `/api/notify-lead` (Resend): email al agente con datos del contacto y botón `wa.me`
  pre-escrito para responder. No existe notificación por WhatsApp al agente → el artículo
  dice "te llega un email al instante… con un botón de WhatsApp listo para escribirle".
- **Renovaciones ancladas al panel.** El copy de la Táctica 5 se redactó como "tu panel te
  marca cada renovación con 60, 30 y 15 días de anticipación" — lo que el agente ve es la
  vista de renovaciones del dashboard y el timeline del lead; ninguna frase implica un
  mensaje de renovación enviado al agente.
- **Sin canibalización**: "conseguir clientes / más clientes" solo aparece en copy interno
  del dashboard; `/agentes` y la página CRM atacan "dejar de perder clientes" (retención),
  este artículo ataca adquisición — se complementan. Slug libre en rutas, sitemap,
  next.config y vercel.json.
- **Los artículos no van a `llms.txt`** (solo páginas principales). Alta de un artículo =
  entrada en `articles.ts` (índice + sitemap automáticos) + enlaces entrantes manuales; no
  hay mecanismo de "relacionados", el cross-linking es manual dentro de la prosa.

## Decisiones y desviaciones aceptadas

- **OG heredado**: los artículos publicados no definen OG/Twitter propio (lo heredan del
  layout de /recursos, cuyo bloque OG apunta a `/recursos`). Se replicó el patrón vigente
  sin "mejorarlo": metadata del artículo = solo title, description y canonical relativo.
- **Categoría nueva "Crecimiento"** (tercera junto a "Elegibilidad 2027" y "Herramientas
  del agente"): la intención de adquisición no cabía en las existentes.
- **H2 de cierre propio** ("Por dónde empezar esta semana"), desviación del artículo de
  referencia que cierra sin H2: con 6 secciones el cierre necesitaba ancla; el patrón de
  los dos enlaces finales (contextual a la CRM + `/agentes` con flecha) sí se replicó.
- **Cifras solo desde `ACA_STATS`**: `oepDias`, `pagoNetoPct`, `oepInicio`, `oepFin`.
  Ninguna otra cifra en el artículo; la description del registro se redactó sin números
  para no hardcodear cifras fuera de la constante.
- **Reglas de copy**: sin promesas de ingresos, sin testimonios, sin superlativos, sin
  jerga de IA, sin auto-renewal 2028; HealthSherpa no se menciona (no es el tema);
  leads comprados/revendidos tratados con honestidad y sin nombrar vendedores.
- **Enlace entrante único** desde la card del link de cotización (S3) de
  `/crm-para-agentes-de-obamacare` — un solo cambio en ese archivo.

## Gate y verificación runtime

Gate (los tres en verde antes de commitear):

- `npx tsc --noEmit` ✅
- `npm test` ✅ — **239/239 tests, 31/31 archivos** (vitest)
- `npm run build` ✅ — `/recursos/como-conseguir-clientes-de-obamacare` prerenderizada estática (○)

Runtime real (build de producción: `PORT=3111 npm run start`, no dev):

- Artículo → **HTTP 200** ✅
- H1 literal "Cómo conseguir clientes de Obamacare: guía para agentes" ✅
- `<link rel="canonical" href="https://enrollsalud.com/recursos/como-conseguir-clientes-de-obamacare">` ✅
- JSON-LD parseado (python3): `@type == Article`, `headline` idéntico al title del registro,
  `datePublished == 2026-07-20`, `mainEntityOfPage.@id` con la URL absoluta del artículo ✅
- `/recursos` muestra la tarjeta nueva (slug presente en el HTML) ✅
- `/sitemap.xml` contiene `<loc>…/recursos/como-conseguir-clientes-de-obamacare</loc>` ✅
- `/crm-para-agentes-de-obamacare` → HTTP 200 y contiene el enlace a la guía ✅
- Servidor detenido y confirmado (curl posterior falla) ✅

## Checklist replicable (delta sobre el del Guión 1, para próximos artículos)

1. PASO 0 solo lectura incluye **fact-check del producto**: el artículo solo afirma
   features confirmadas en código, con canal exacto (email vs WhatsApp, panel vs mensaje).
2. Réplica exacta del esqueleto de artículo: registro primero, metadata mínima con
   canonical, JSON-LD Article, `rec-article` + `rec-prose` con tags planos.
3. Alta = `articles.ts` + enlaces entrantes manuales (sin llms.txt para artículos).
4. Gate tsc + tests + build; runtime sobre `next start` con JSON-LD parseado y asserts
   contra el registro, no contra strings sueltos.
