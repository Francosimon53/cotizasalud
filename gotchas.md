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

## `git diff --name-status <rama> origin/main` no predice qué borra un merge

Los `D` de ese diff son *dirección de diff* ("para ir de la rama a main hay que
borrar X"), no una predicción de que el merge borrará X. Un merge de tres vías
nunca elimina commits que llegaron a `main` después del merge-base. Confundirlo
lleva a asumir regresiones inexistentes y a rebases innecesarios sobre ramas ya
publicadas. Para predecir el resultado real: `git merge-tree --write-tree HEAD
origin/main` (exit 0 y salida de una sola línea = sin conflictos) y comparar el
árbol resultante contra ambos lados con `git diff <tree> origin/main -- <paths>`.

## `DashboardHeader` sólo recibe `isAdmin` en 1 de las 6 páginas que lo renderizan

`isAdmin` controla el botón "Equipo" (`DashboardHeader.tsx:26`). Se pasa únicamente en
`src/app/agentes/dashboard/page.tsx:110`. Las otras cinco rutas montan el header sin el prop,
así que un admin **pierde el botón "Equipo" en cuanto sale del dashboard principal** — incluso
estando dentro de `/team`:

- `src/app/agentes/dashboard/profile/page.tsx:50`
- `src/app/agentes/dashboard/renewals/page.tsx:29`
- `src/app/agentes/dashboard/import/page.tsx:21`
- `src/app/agentes/dashboard/team/page.tsx:52`
- `src/app/agentes/dashboard/share/page.tsx:24`

La lista de admins está duplicada en tres sitios (`dashboard/page.tsx:110`,
`team/page.tsx:9`, `api/admin/toggle-agent/route.ts:6`), lo que hace fácil que se desincronicen.
Arreglo de raíz: resolver el admin dentro del propio header a partir del slug, o extraer
`ADMIN_SLUGS` a un módulo compartido — no seguir pasando el prop a mano en cada página.

Detectado el 2026-08-10 durante el PR de acceso móvil. **RESUELTO** ese mismo día en el mismo
PR, una vez que la observación en dispositivo real lo confirmó en vivo: el admin se resuelve
ahora dentro de `DashboardHeader` a partir del slug, y `ADMIN_SLUGS` vive en
`src/lib/admin-slugs.ts` como fuente única. Se conserva la entrada porque la lección sigue
vigente: **un permiso que se pasa por prop desde N sitios se olvida en N-1 de ellos.**

## iOS Safari hace auto-zoom con `input`/`select`/`textarea` bajo 16px — y no es reproducible fuera del dispositivo

Safari en iOS hace zoom automático al **enfocar** cualquier campo con `font-size` menor que
16px. El zoom **persiste** el resto de la sesión: el viewport visual queda más chico que el de
layout y toda página posterior aparece recortada por ambos lados con scroll horizontal. El
síntoma parece un desbordamiento de layout y no lo es.

Nada de esto lo detecta: Chrome de escritorio (no hace auto-zoom), la emulación de dispositivo
de DevTools (simula tamaño, no el comportamiento de Safari), un harness con iframe `srcdoc`
(el iframe tiene su propio viewport), una ventana popup con viewport real (sigue siendo Blink),
ni el gate — `fontSize: 15` compila exactamente igual que `16`.

**La única verificación válida es dispositivo real tocando un campo.** Cargar la página y
mirarla no basta: el zoom se dispara al enfocar, no al cargar.

El arreglo es subir el `font-size` a 16, **nunca** `maximum-scale=1` ni `user-scalable=no`:
bloquear el zoom es una barrera de accesibilidad.

Corolario de método, aprendido a base de un falso verde en este mismo PR: **un harness que solo
contiene el componente bajo prueba no puede detectar problemas causados por el resto de la
página ni por el estado del navegador.** Si un harness no reproduce el fallo conocido, no sirve
para confirmar el arreglo — hay que validar primero que el harness sabe fallar.

## `git checkout --theirs a b` sobrescribe TODOS los paths, y lo hace en silencio

Encadenar `git checkout --theirs archivo-A archivo-B` (o dos invocaciones con `&&`) para
"resolver A" arrasa también B con el lado de main, sin aviso y sin diff que lo delate: el
archivo simplemente pierde el lado propio. Ocurrió al mergear #63 en la rama de cartera —
`gotchas.md`, que debía conservar AMBOS lados, quedó solo con el de main y perdió 4 entradas.

Regla: `--theirs`/`--ours` solo sobre el archivo cuya resolución es literalmente "quédate un
lado entero", nunca en la misma línea que un archivo de resolución manual. Y verificar el
resultado con una métrica del contenido (`grep -c '^## '`), no con `git status`, que sigue
mostrando `UU` igual.

Rescate: hasta el commit, los tres lados siguen en el índice —
`git cat-file -p :1:archivo` (base), `:2:` (ours/HEAD), `:3:` (theirs). Nada se pierde de
verdad mientras no se haya commiteado.
