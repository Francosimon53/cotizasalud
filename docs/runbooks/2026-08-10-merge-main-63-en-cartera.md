# Merge de `origin/main` (PR #63, acceso móvil) en `feature/modulo-oep-cartera`

**Fecha:** 2026-08-10
**Rama:** `feature/modulo-oep-cartera` (PR #61, módulo Mi Cartera OEP)
**Merge base:** `a299d7a`
**Lado main:** `a63c050` — `fix(movil): desbloquear el acceso del agente desde el teléfono (#63)`
**Commit de merge:** `8eb72a2`

## Resultado medible definido de antemano

El merge se considera correcto si, sobre el árbol resultante:

1. `npx tsc --noEmit` sale limpio.
2. `npm test` pasa entero.
3. El build de producción compila con la flag de cartera encendida.
4. No queda ni un rastro del contrato viejo del header (`isAdmin=`, `navBtn`).
5. Las 6 entradas nuevas de `gotchas.md` (4 de la rama + 2 de main) siguen presentes.
6. `/agentes/dashboard/cartera` y las dos rutas API de cartera siguen siendo dinámicas (`ƒ`).

## Contexto: por qué había conflicto

El PR #63 reescribió `DashboardHeader.tsx` por completo:

- migró de estilos inline a clases CSS (`.dh-header`, `.dh-brand`, `.dh-nav`, `.dh-btn`)
  definidas en `src/app/agentes/agentes.css`, con media query a 760px;
- cambió la firma del componente: el prop `isAdmin` desapareció y entró `agentSlug`
  (requerido), resolviéndose el admin dentro del componente vía `isAdminSlug()` del
  nuevo módulo `src/lib/admin-slugs.ts`.

Esta rama, sobre la versión vieja, había añadido un import de `isCarteraEnabled` y un
botón condicional "Mi Cartera". Ambos lados tocaron el mismo archivo → conflicto real.

## Guion ejecutado

### Paso 0 — Investigación read-only

| Acción | Verificación | Resultado |
|---|---|---|
| `git merge-tree --write-tree origin/main HEAD` | lista de archivos en conflicto | `gotchas.md` y `DashboardHeader.tsx`, nada más |
| `git diff --name-only a299d7a HEAD` vs `… origin/main` | intersección = candidatos a conflicto | exactamente esos 2 archivos |
| `grep dh- agentes.css` en main | ¿existe patrón de variante de botón? | sí: `.dh-btn-admin` (color + border-color + `:hover`) |
| `grep accent agentes.css` en main | ¿hay variable para el cian? | sí: `--accent-2: #06b6d4`, el mismo hex del inline |
| `grep select( cartera/page.tsx` | ¿trae ya el slug? | **no** — `select("id, name, agency_name")` |

Hallazgo que no reporta `merge-tree`: `cartera/page.tsx` es nuevo en la rama, así que
no da conflicto, pero monta el header sin `agentSlug` → el árbol mergeado no compila.
Es el fallo silencioso de este merge.

### Paso 1 — Merge y resolución

```
git merge origin/main --no-commit
```

Verificación: conflicto en los 2 archivos previstos, ni uno más. ✅

**`DashboardHeader.tsx`** — se toma el lado de main íntegro y se reinjertan las dos
piezas de la rama:

```
git checkout --theirs src/app/agentes/dashboard/DashboardHeader.tsx
diff <(git show origin/main:…/DashboardHeader.tsx) …/DashboardHeader.tsx   # idéntico
```

luego el import de `isCarteraEnabled` y el botón, entre "Equipo" y "Renovaciones":

```tsx
{isCarteraEnabled() && (
  <button onClick={() => router.push("/agentes/dashboard/cartera")} className="dh-btn dh-btn-cartera">
    Mi Cartera
  </button>
)}
```

**`gotchas.md`** — ambos lados eran apéndices puros al final (base = 37 líneas,
intactas en los dos lados). Reconstruido desde los tres stages del índice:

```
git cat-file -p :1:gotchas.md   # base
git cat-file -p :2:gotchas.md   # ours (HEAD)
git cat-file -p :3:gotchas.md   # theirs (main)
{ head -37 base; sed -n '38,74p' ours; sed -n '38,84p' theirs; } > gotchas.md
```

Verificación: 121 líneas = 37 + 37 + 47, 13 títulos `##` (7 de base + 4 + 2), cero
marcadores de conflicto. ✅

### Paso 2 — Ediciones sin las que el árbol no compila

**`agentes.css`**, justo debajo de `.dh-btn-admin:hover`, calcando ese patrón:

```css
.dh-btn-cartera {
  color: var(--accent-2);
  border-color: rgba(6, 182, 212, 0.3);
}
.dh-btn-cartera:hover { color: #22d3ee; border-color: rgba(6, 182, 212, 0.5); }
```

**`cartera/page.tsx`**: `+ slug` al select de `agents` y `agentSlug={agent.slug}` al
header.

Las otras 6 páginas del dashboard llegan limpias desde main y ya pasan `agentSlug`;
no se tocan.

## Reporte de verificación

| # | Esperado | Comando | Obtenido |
|---|---|---|---|
| 1 | typecheck limpio | `npx tsc --noEmit` | exit 0 ✅ |
| 2 | tests verdes | `npm test` | 37 archivos, 303 tests, 0 fallos ✅ |
| 3 | build compila | `STRIPE_SECRET_KEY=sk_test_dummy_for_build NEXT_PUBLIC_FEATURE_CARTERA=1 npm run build` | exit 0, "Compiled successfully in 12.8s" ✅ |
| 4 | 0 resultados | `git grep -n "isAdmin=" -- src/` | 0 ✅ |
| 5 | 0 resultados | `git grep -n "navBtn" -- src/app/agentes/dashboard/DashboardHeader.tsx` | 0 ✅ |
| 6 | 6 entradas nuevas presentes | `grep` por título en `gotchas.md` | las 6, total 13 títulos ✅ |
| 7 | rutas dinámicas | tabla de rutas del build | `ƒ /agentes/dashboard/cartera`, `ƒ /api/cartera`, `ƒ /api/cartera/import` ✅ |

**Pendiente, no verificable aquí:** el botón cian en el teléfono. Lo comprueba el
usuario en Preview tras el push. Según la gotcha de iOS del propio PR #63, DevTools no
sustituye al dispositivo real para el comportamiento de Safari.

## Notas de método

- El worktree `es-cartera` no tenía `node_modules`. El primer `tsc` escupió cientos de
  `Cannot find module 'react'` que **no eran del merge**; se resolvió con `npm ci`
  (`package-lock.json` no quedó modificado). Conviene descartar dependencias ausentes
  antes de leer un typecheck rojo como regresión.
- `git checkout --theirs a b` aplica a **todos** los paths que se le pasan. Encadenarlo
  con un archivo que se resuelve por otra vía sobrescribe ese archivo en silencio: aquí
  dejó `gotchas.md` con solo el lado de main, borrando las 4 entradas de la rama. Se
  detectó al contar los títulos y se rehízo desde los stages del índice, que siguen
  disponibles hasta el commit. Gotcha registrada.
