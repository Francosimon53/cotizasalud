# Merge de `origin/main` hacia `feature/modulo-oep-cartera`

**Fecha:** 2026-08-06
**Rama:** `feature/modulo-oep-cartera` (PR #61, módulo Mi Cartera OEP)
**Motivo:** la rama salió de `f335d67` y nunca se actualizó. Después, `main` recibió
`a299d7a` (PR #62, artículo `/recursos/como-conseguir-clientes-de-obamacare`).

## Riesgo evaluado antes de ejecutar

La hipótesis inicial era que mergear la rama tal cual revertiría el artículo. **Es falsa.**

- `git diff --name-status HEAD origin/main` lista los archivos del artículo como `A` y los de
  cartera como `D`, pero eso es *dirección de diff*, no predicción de merge.
- Un merge de tres vías nunca borra commits que llegaron a `main` después del merge-base.
- La intersección de archivos entre la rama y `a299d7a` es **vacía**: la rama no toca
  `src/app/recursos/articles.ts`, `src/app/crm-para-agentes-de-obamacare/page.tsx`,
  `src/app/recursos/como-conseguir-clientes-de-obamacare/page.tsx` ni el runbook del artículo.

Se hizo el merge igualmente para que CI y el deploy de Preview corran contra el código
que realmente irá a producción.

## Por qué merge y no rebase

- El rebase reescribiría los 17 SHAs de una rama ya publicada en `origin` con PR abierto,
  obligando a `--force-with-lease` y rompiendo las referencias de los runbooks previos.
- No había conflictos ni historial que limpiar, así que el rebase no aportaba nada.
- El PR se squashea al final de todos modos.

## Guion ejecutado

| # | Acción | Verificación | Resultado |
|---|---|---|---|
| 1 | `git fetch origin` + `git status --porcelain` | árbol limpio, `origin/main` en `a299d7a` | OK, salida vacía |
| 2 | `git merge origin/main --no-ff` | exit 0, sin conflictos | OK, estrategia `ort`, 4 archivos / +333 −1 |
| 3 | `git diff origin/main -- <4 archivos del artículo>` | diff vacío | OK, byte-idénticos a `main` |
| 4 | `git log --oneline origin/main ^HEAD` | vacío | OK, sin commits pendientes |
| 5 | `git ls-files \| grep -cE 'cartera\|feature-flags\|portfolio'` | 27 | OK |
| 6 | `npx tsc --noEmit` | exit 0 | OK, sin salida |
| 7 | `npm test` (vitest run) | suite verde | OK, 37 archivos / 303 tests |

Simulación previa (read-only) con `git merge-tree --write-tree HEAD origin/main`:
exit 0, árbol `16f7248`, sin marcadores de conflicto. GitHub reportaba
`mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`.

## Resultado

- Merge commit: `92c954d`
- La rama contiene simultáneamente el módulo de cartera (27 archivos) y el artículo.
- `/recursos/como-conseguir-clientes-de-obamacare` sobrevive idéntico a `main`,
  con su entrada en `articles.ts` y su enlace desde `crm-para-agentes-de-obamacare/page.tsx`.
- Typecheck y tests verdes tras el merge.

## Pendiente

- `git push` de la rama (no ejecutado en esta sesión, requiere OK explícito).
- Verificar el deploy de Preview tras el push: que `/recursos/como-conseguir-clientes-de-obamacare`
  responda 200 y que `/agentes/dashboard/cartera` siga gateado por `NEXT_PUBLIC_FEATURE_CARTERA=1`.

## Gotcha

`git diff --name-status <rama> origin/main` **no** predice qué borra un merge. Para eso se usa
`git merge-tree --write-tree`, y se compara el árbol resultante contra ambos lados.
Registrado también en `gotchas.md`.
