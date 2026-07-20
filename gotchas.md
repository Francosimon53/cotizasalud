# Gotchas

Project-specific snags hit during work. Read this before starting a task here.

## Vercel CLI: `vercel env add <NAME> preview --yes` is not enough

The CLI still asks for a git branch and refuses to proceed even with `--value <v> --yes` flags. The fix is to pass an empty string as the third **positional** argument so it applies to all Preview branches:

```sh
vercel env add MY_VAR preview "" --value "$VAL" --yes
```

The CLI's own hint (`vercel env add NAME preview --value <v> --yes`) is wrong — that command loops back to the same prompt. Verified on Vercel CLI 51.8.0.

## zsh doesn't support `${!VAR}` indirect expansion

Loops that need indirect variable lookup (`for VAR in A B; do echo "${!VAR}"; done`) fail with `bad substitution` in zsh. Wrap the loop in an explicit `bash -c '...'` when you need this pattern. The default shell on macOS is zsh, so this trips up env-var scripts.

## Next.js `current_period_*` lives on the SubscriptionItem in Stripe API ≥ dahlia

In Stripe API version `2026-04-22.dahlia` (the default in `stripe ^22`), `current_period_start` and `current_period_end` are no longer top-level on `Stripe.Subscription` — they're on `subscription.items.data[0]`. Older snippets that read `subscription.current_period_end` directly will TS-error. Read from the item.

## Vercel CLI: `env add` por stdin puede guardar valor VACÍO sin error

Con el plugin en modo no-interactivo, `pbpaste | vercel env add NAME production` responde "Added Environment Variable" pero puede ignorar el stdin y guardar `""`. Verificar SIEMPRE después de cargar: `vercel env pull` + grep del formato esperado (a ciegas si es secreto). La vía confiable es `--value "$(pbpaste)"` expandido en el shell del usuario.

## Vercel: `env pull --environment=X` puede servir un valor cacheado rancio

Tras corregir una variable, `vercel env pull` siguió devolviendo el valor viejo (vacío) para Production durante varios minutos, mientras Development (nunca consultado en el estado viejo) bajaba bien. La verdad de campo para `NEXT_PUBLIC_*` es el bundle desplegado: `curl` de los chunks `/_next/static/chunks/*.js` y `grep -c` del prefijo esperado.

## PostHog proxy `/srx/`: el 404 de la raíz es del UPSTREAM, no de la app

`curl https://enrollsalud.com/srx/` devuelve 404 con el erizo ASCII de PostHog — la rewrite funciona y es PostHog quien 404ea su raíz. Smoke checks correctos: `/srx/static/array.js` → 200 JS y `/srx/decide?v=3` → 200 JSON. Un 404 pelado en `/srx/` NO indica rewrite rota; un 404 con la página de Next sí.

## El clasificador de auto-mode bloquea abrir/curl-ear URLs de Stripe Checkout live

Navegar con Chrome o hacer `curl` a `checkout.stripe.com/c/pay/cs_live_...` es denegado por el clasificador de permisos (página de pago live). La smoke visual del checkout debe hacerla el usuario con el link; la prueba automatizable es a nivel API: `checkout.sessions.create` valida `trial_period_days` en la creación — si Stripe acepta la sesión, la UI la renderiza.

## posthog-js (npm) no expone window.posthog ni usa el fetch parcheado

Con `import posthog from "posthog-js"` (v1.404), el SDK captura referencias a
`fetch`/`sendBeacon` al evaluarse el módulo: monkeypatchear `window.fetch` o
`XMLHttpRequest` después de cargar la página NO intercepta los payloads de
`/srx/e/`, y `window.posthog` no existe. Para verificar payloads: unit test
mockeando `posthog-js` (ver `src/lib/__tests__/analytics-cartera.test.ts`) +
`localStorage.setItem('ph_debug','true')` para confirmar el nombre del evento
en consola.

## node --experimental-strip-types no resuelve imports TS sin extensión

`import { x } from "./fpl"` (sin `.ts`) falla con ERR_MODULE_NOT_FOUND al
ejecutar TS directo con Node 24 strip-types. Para scripts rápidos sobre código
del repo, usar un test de vitest (resuelve igual que el bundler) en vez de
`node -e`.

## El clasificador de auto-mode puede bloquear `apply_migration` (MCP Supabase)

En la Fase A la migración se aplicó vía MCP sin problema; en la Fase B el
mismo tipo de llamada (DDL remoto con `apply_migration`) fue denegado por el
clasificador de permisos. No intentar rodearlo (p. ej. metiendo DDL por
`execute_sql`): dejar la migración lista en `supabase/migrations/`, avisar al
usuario y que él apruebe/ejecute. Verificar el estado de las tablas con un
SELECT antes, para saber si los pasos destructivos (DELETE de backfill) tocan
datos reales.
