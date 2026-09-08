# 2026-09-08 — Home B2B para agentes, copy B2C a /seguro-medico, CTAs a registro

**Rama:** `feat/home-b2b-agentes`
**Objetivo:** `/` pasa a ser la landing B2B para agentes (la que vivía en `/agentes`),
el copy B2C actual se conserva en `/seguro-medico`, y los CTAs primarios de la landing
de agentes dejan de apuntar al cotizador del consumidor.

**Contexto (PostHog, 60 días):** `/` 33 visitantes, `/cotizar` 2, `/q/*` 4. No hay flujo
B2C que proteger.

**Resultado medible:**
- (a) `GET /` sirve el H1 «Deja de perder clientes por cotizar tarde», título
  «EnrollSalud para Agentes | Cotizador ACA con tu marca + CRM», canonical `https://enrollsalud.com/`.
- (b) `GET /agentes` sirve el mismo contenido con canonical `https://enrollsalud.com/` (alias, sin redirect).
- (c) `GET /seguro-medico` sirve el H1 «¿Tu seguro subió y nadie te explica por qué?» con
  título y OG B2C, canonical `https://enrollsalud.com/seguro-medico`.
- (d) Ningún CTA primario de la landing de agentes apunta a `/cotizar`; hero y cierre van a `/agentes/registro`.
- (e) `/sitemap.xml` lista 13 URLs (12 + `/seguro-medico`).
- (f) `npm run build` verde y `npx vitest run` verde.
- Prueba final (usuario, Preview + PostHog Live): clic en un plan desde `/` llega como `plan_cta_click`.

---

## Guion ejecutado

### 0. Verificación del contexto contra el repo
- `pwd` = `/Users/simonfranco/enrollsalud`, rama `feat/home-b2b-agentes`, árbol limpio.
- Confirmado: `src/app/page.tsx` era B2C con sección «Dos audiencias»; `src/app/agentes/page.tsx`
  tenía dos `Link href="/cotizar"` («Empieza a cotizar gratis», hero y cierre); layout raíz con
  canonical `/` y metadata B2C; `capturePlanCtaClick(plan, interval)` en `src/lib/analytics.ts`;
  sitemap con 12 URLs. **Todo coincidía**; no hubo que parar.
- Baseline vitest: 772 tests (96 archivos). Ojo: vitest recorre también las copias en
  `.claude/worktrees/*` (git-ignoradas). Solo `src/` del repo: **294 tests, 34 archivos**.

### 1. `/seguro-medico` con el copy B2C
- `git mv src/app/page.tsx src/app/seguro-medico/page.tsx`; import de CSS pasa a `../landing.css`
  (el CSS se queda en `src/app/`, sin duplicar).
- Nav: «Para Agentes» y «Soy Agente» → `href="/"`.
- Eliminada la sección «Dos audiencias» completa y sus 19 reglas `.audience*` de `landing.css`
  (CSS que quedaría muerto).
- Nuevo `src/app/seguro-medico/layout.tsx` con la metadata B2C que estaba en el layout raíz,
  canonical `/seguro-medico` y `openGraph.url` `https://enrollsalud.com/seguro-medico`
  (el `og:url` se alinea con el canonical en vez de conservar `https://enrollsalud.com`).
- **Verificación:** build verde; `curl /seguro-medico` → H1 B2C, título B2C, canonical
  `/seguro-medico`, 0 coincidencias de «Dos audiencias».

### 2. Componente compartido `AgentesLanding`
- `git mv src/app/agentes/page.tsx src/components/landing/AgentesLanding.tsx`.
- `agentes.css` y `PricingSection.tsx` **se quedan** en `src/app/agentes/` porque los importan
  otras 12 rutas (dashboard, login, registro, setup, crm-para-agentes-de-obamacare). El
  componente los importa vía alias `@/app/agentes/...`.
- `src/app/page.tsx` y `src/app/agentes/page.tsx` solo renderizan `<AgentesLanding />`.
- **Verificación:** el HTML de `/` y `/agentes` es idéntico salvo el payload del router RSC
  (nombres de segmento `""` vs `"agentes"`). Head idéntico, mismo canonical.

### 3. CTAs
- Hero y cierre: `href="/agentes/registro"`, texto «Crea tu cuenta gratis»,
  `onClick={() => capturePlanCtaClick("pro", "month", "hero" | "cierre")}`.
- `capturePlanCtaClick` recibe un **tercer argumento opcional** `ubicacion?: "hero" | "cierre"`
  (la firma tenía 2 args, no 3). `PricingSection` no cambia: sus eventos no llevan `ubicacion`.
- Enlace secundario bajo el hero: «Ver el cotizador que verá tu cliente →» → `/cotizar`,
  clase nueva `.ag-hero-link` en `agentes.css`.
- FAQ «¿Cómo empiezo?» conserva `enrollsalud.com/agentes/registro`.
- **Verificación:** `grep -c 'href="/cotizar"' src/components/landing/AgentesLanding.tsx` → **1**.

### 4. Metadata
- Layout raíz: title/description/OG/twitter de agentes, canonical `/`, `openGraph.url`
  `https://enrollsalud.com/`.
- `src/app/agentes/layout.tsx`: canonical `/` y `openGraph.url` `https://enrollsalud.com/`.
- JSON-LD `SoftwareApplication.url` → `https://enrollsalud.com/`.
- **Verificación:** `curl` de `/` y `/agentes` → `<link rel="canonical" href="https://enrollsalud.com">`
  en ambos. Next normaliza `"/"` sobre `metadataBase` **sin barra final**; es el mismo
  comportamiento que tenía el sitio antes del cambio (canonical `/` en el layout raíz).

### 5. Sitemap
- `+ /seguro-medico` (0.8), `/cotizar` 1.0 → 0.8, `/agentes` 0.9 → 0.5.
- **Verificación:** `curl /sitemap.xml | grep -c "<loc>"` → **13**.

### 6. Build y tests
- `npx tsc --noEmit` (filtrando `.next/`): sin errores.
- `npm run build`: verde, `/seguro-medico` aparece como ruta estática.
- `npx vitest run`: 772/772 (igual que baseline); solo `src/`: 294/294. Ningún test asumía
  el H1 o título antiguos de `/`; no se tocó ningún test.

### 7. PR y Preview
- Commit y push de `feat/home-b2b-agentes`; PR #69 contra `main` en draft, sin merge.
- Preview: `https://cotizasalud-git-feat-home-b2b-e6f3f6-francosimon-7079s-projects.vercel.app`
  (Deployment Protection activa: verificado con `vercel curl /ruta --deployment <url> --yes`).
- (a)-(e) repetidos contra el Preview: mismos resultados que en local (tabla abajo).
- Capturas full-page del Preview con Playwright + header `x-vercel-trusted-oidc-idp-token`
  en `docs/img/home-b2b-{home,agentes,seguro-medico}.jpg`.

### Hallazgo: PostHog no está activo en Preview
`vercel env ls` muestra `NEXT_PUBLIC_POSTHOG_KEY` solo en **Development** y **Production**;
no existe para **Preview**. Confirmado en el bundle del Preview: el chunk que inicializa
PostHog (`api_host: "/srx"`) no contiene ninguna clave `phc_`. Con la clave ausente,
`capturePlanCtaClick` es no-op (`enabled()` devuelve false), así que **la prueba final
"clic en un plan desde / llega como plan_cta_click" no puede pasar en el Preview** hasta
que se cargue la variable para Preview. No se cargó desde esta sesión (cambio de
configuración del proyecto con valor secreto). Comando (ver gotchas sobre `env add`):

```sh
vercel env add NEXT_PUBLIC_POSTHOG_KEY preview "" --value "$(pbpaste)" --yes
```

Tras cargarla hay que redesplegar el Preview (push vacío o `vercel redeploy`) y verificar
`phc_` en el chunk de instrumentación, no fiarse de "Added".

## Reporte de verificación

| Criterio | Esperado | Obtenido (local `next start` **y** Preview) |
|---|---|---|
| (a) `/` | H1 agentes, título agentes, canonical `/` | ✅ H1 «Deja de perder clientes por cotizar tarde», título correcto, canonical `https://enrollsalud.com` |
| (b) `/agentes` | mismo contenido, canonical `/`, sin redirect | ✅ HTTP 200 sin redirect, mismo head y body, canonical `https://enrollsalud.com` |
| (c) `/seguro-medico` | H1 B2C, título/OG B2C, canonical `/seguro-medico` | ✅ |
| (d) CTAs | hero y cierre → `/agentes/registro`, 1 solo `/cotizar` (secundario) | ✅ 2 × `ag-btn-primary` a `/agentes/registro`, 1 × `/cotizar` «Ver el cotizador…» |
| (e) sitemap | 13 `<loc>` | ✅ 13 |
| (f) build + tests | verde | ✅ build verde, 772/772 (294/294 en `src/`) |

| Prueba final PostHog | `plan_cta_click` en Live desde `/` | ⏳ Bloqueada: falta `NEXT_PUBLIC_POSTHOG_KEY` en Preview (ver hallazgo) |

## Notas / riesgos
- `src/app/agentes/layout.tsx` sigue aplicando su metadata a las subrutas sin metadata propia
  (`/agentes/login`, `/agentes/registro`, …). Antes heredaban canonical `/agentes`; ahora heredan
  canonical `/`. Mismo tipo de imprecisión que ya existía, no introducida por este cambio.
- Ninguna ruta enlaza todavía a `/seguro-medico`; el copy B2C queda accesible por URL y por sitemap.
