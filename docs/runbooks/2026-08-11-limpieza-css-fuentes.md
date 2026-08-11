# 2026-08-11 — Limpieza de CSS muerto y peticiones de fuentes que no cargan

**Rama:** `chore/limpieza-css-fuentes`
**Objetivo:** limpieza de superficie con **cero cambio visual**. No es una tarea de
diseño: no se eligen fuentes, no se tocan colores ni layout. Todo lo que decide
cómo se ve el sitio queda para una sesión de tipografía aparte.

**Resultado medible:** las familias tipográficas que *efectivamente* resolvían antes
del cambio siguen resolviendo exactamente igual después (misma familia, mismos pesos,
mismos estilos, mismos ficheros `.woff2`). Lo único que desaparece es lo que nunca
llegaba a pintar un píxel.

---

## Hallazgo principal: Satoshi **sí** carga (vía Fontshare)

La auditoría anterior concluyó que Satoshi «nunca llegó a cargar y el texto siempre
cayó al stack del sistema». **Es falso**, y el diagnóstico equivocado venía de un
inventario incompleto de los `<link>` de fuentes: se contaron los 6 de Google Fonts
y se pasó por alto un séptimo que no es de Google.

```
src/app/layout.tsx:35
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,800,900&display=swap" rel="stylesheet" />
```

Verificación:

1. Fontshare responde **200 con `@font-face` reales** para los pesos 400/500/700/900,
   apuntando a `.woff2` en `cdn.fontshare.com`.
2. Ese `<link>` vive en el **root layout**, así que aplica a todas las rutas.
   `src/app/agentes/layout.tsx` y `src/app/recursos/layout.tsx` son layouts
   **anidados** (`return children`, sin `<html>`), no roots alternativos.
3. Por tanto `--font-body: 'Satoshi', …` resuelve **hoy** a Satoshi en `/agentes`,
   `/recursos` y `/crm-para-agentes-de-obamacare`. Es la fuente de cuerpo real.

**Consecuencia para este PR:** quitar `Satoshi` de `--font-body` habría cambiado la
tipografía de cuerpo de tres secciones enteras a `-apple-system`. Se descartó esa
parte del plan. `--font-body` y el link de Fontshare quedan **intactos**.

Lo que sí es ruido demostrado: pedir `Satoshi` dentro de una URL de
`fonts.googleapis.com`. Google **no sirve Satoshi** — la descarta en silencio y
responde 200, de modo que la petición es redundante.

---

## Inventario completo de los 7 `<link>` de fuentes (estado ANTES)

| # | Archivo:línea | Proveedor | Tipo | Familias pedidas |
|---|---|---|---|---|
| 1 | `src/app/layout.tsx:34` | Google | stylesheet | Plus Jakarta Sans `400;500;600;700;800;900` · JetBrains Mono `400;500;700` · **DM Sans** `400;500;600;700;800;900` |
| 2 | `src/app/layout.tsx:35` | **Fontshare** | stylesheet | **Satoshi** `400,500,700,800,900` ← **el que sirve Satoshi de verdad** |
| 3 | `src/app/agentes/page.tsx:1002` | Google | preconnect | — |
| 4 | `src/app/agentes/page.tsx:1003` | Google | stylesheet | Instrument Serif `ital@0;1` · ~~Satoshi~~ · JetBrains Mono `400;500` |
| 5 | `src/app/recursos/layout.tsx:31` | Google | stylesheet | Instrument Serif `ital@0;1` · ~~Satoshi~~ · JetBrains Mono `400;500` |
| 6 | `src/app/crm-para-agentes-de-obamacare/page.tsx:85` | Google | preconnect | — |
| 7 | `src/app/crm-para-agentes-de-obamacare/page.tsx:86` | Google | stylesheet | Instrument Serif `ital@0;1` · ~~Satoshi~~ · JetBrains Mono `400;500` |

> **Dato que se perdió en la auditoría anterior:** el nº 2. Satoshi carga por ahí.
> Cualquier futura sesión de tipografía debe partir de este inventario de 7, no de 6.

---

## Guion ejecutado

### PASO 0 — Verificación read-only (antes de borrar nada)

| # | Comprobación | Resultado |
|---|---|---|
| 0.1 | `grep -rn "_CSS_REMOVED" src` | Única aparición es su propia definición en `src/app/agentes/page.tsx:8`. **Cero referencias.** El template literal ocupa las líneas 8–824. |
| 0.2 | `grep -rni "dm sans\|DM_Sans" src` | Única aparición: dentro de la URL de `layout.tsx:34`. **Ningún `font-family` la nombra.** |
| 0.3 | Inventario de `<link>` | 7 en total (ver tabla arriba): 6 de Google + 1 de Fontshare. |
| 0.4 | Ejes/pesos de JetBrains Mono | Link global `400;500;700` ⊇ links de página `400;500`. **El global es superconjunto.** |
| 0.5 | Valores literales de los `:root` | Ver tabla de control abajo. |

**0.4 — verificación reforzada (más allá de comparar los pesos del texto de la URL):**
se descargó el `.woff2` de peso 400 / rango latin desde ambas URLs y se comparó el
binario.

```
global  (…&family=JetBrains+Mono:wght@400;500;700&…)  31340 B  sha256 2c32b9b3ee358c11…
página  (…&family=JetBrains+Mono:wght@400;500&…)      31340 B  sha256 2c32b9b3ee358c11…
                                                                 → IDÉNTICO
```

Mismos `unicode-range`, mismos ficheros. La deduplicación queda autorizada.

### PASO 1 — Borrar el bloque muerto

Eliminada la constante `_CSS_REMOVED` completa de `src/app/agentes/page.tsx`
(líneas 8–825, incluida la línea en blanco que la seguía). **818 líneas.**
Ese bloque contenía además un cuarto `:root` duplicado, que muere con él.

### PASO 2 — Quitar lo que no carga y lo que no se usa

- **Satoshi fuera de las URLs de Google** (links #4, #5, #7). Google la descarta;
  demostrado byte a byte más abajo.
- **`--font-body` NO se toca** en ningún `:root`. Satoshi es la fuente de cuerpo real.
- **El link de Fontshare (`layout.tsx:35`) NO se toca.**
- **DM Sans fuera** del link global — cero referencias en todo `src`.
- **JetBrains Mono deduplicado**: se retira de los 3 links de página, que quedan
  pidiendo solo Instrument Serif. El link global sigue sirviéndola con el mismo
  `.woff2` (sha256 idéntico, verificado en 0.4).
- Comentario añadido sobre `--font-body` en `agentes.css` y `recursos.css`
  documentando de dónde viene Satoshi realmente.

No se tocaron Instrument Serif, Plus Jakarta Sans ni Space Mono. **No se unificaron
los 3 `:root`** — eso es trabajo de la sesión de diseño.

URLs resultantes:

```diff
- css2?family=Plus+Jakarta+Sans:wght@…&family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@…&display=swap
+ css2?family=Plus+Jakarta+Sans:wght@…&family=JetBrains+Mono:wght@400;500;700&display=swap

- css2?family=Instrument+Serif:ital@0;1&family=Satoshi:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap
+ css2?family=Instrument+Serif:ital@0;1&display=swap
```

---

## PASO 3 — Gate y prueba de cero cambio visual

### Gate

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | **0 errores en código fuente.** Quedan 3 errores `TS2307` en `.next/dev/types/validator.ts`, tipos generados obsoletos que apuntan a rutas `cartera` inexistentes en esta rama. **Preexistentes**: se reprodujeron idénticos en `main` sin ningún cambio aplicado. |
| `npm test` | **93 archivos, 717 tests, todos en verde.** |
| `npm run build` | **OK**, todas las rutas compiladas. |

### Control de `:root` — las familias que resolvían siguen resolviendo igual

| `:root` | Variable | Antes | Después | Familia que resuelve |
|---|---|---|---|---|
| `landing.css:2` | `--font-display` | `'Plus Jakarta Sans',system-ui,sans-serif` | *(sin cambios)* | Plus Jakarta Sans (link global) ✅ |
| | `--font-mono` | `'Space Mono',monospace` | *(sin cambios)* | ⚠️ `monospace` — ver nota |
| | `--font-body` | *(no la define)* | *(no la define)* | — |
| `agentes/agentes.css:3` | `--font-display` | `'Instrument Serif', Georgia, serif` | *(sin cambios)* | Instrument Serif ✅ |
| | `--font-body` | `'Satoshi', -apple-system, sans-serif` | **sin cambios** | **Satoshi (Fontshare)** ✅ |
| | `--font-mono` | `'JetBrains Mono', monospace` | *(sin cambios)* | JetBrains Mono (link global) ✅ |
| `recursos/recursos.css:5` | `--font-display` | `'Instrument Serif', Georgia, serif` | *(sin cambios)* | Instrument Serif ✅ |
| | `--font-body` | `'Satoshi', -apple-system, sans-serif` | **sin cambios** | **Satoshi (Fontshare)** ✅ |
| | `--font-mono` | `'JetBrains Mono', monospace` | *(sin cambios)* | JetBrains Mono (link global) ✅ |
| ~~`agentes/page.tsx:11`~~ | — | *(cuarto `:root`, dentro de `_CSS_REMOVED`)* | **eliminado** | era código muerto |

**Ninguna declaración `--font-*` cambió de valor.** Los únicos `:root` editados lo
fueron para añadir un comentario.

> ⚠️ **Nota preexistente, fuera del alcance de este PR:** `landing.css` declara
> `--font-mono: 'Space Mono', monospace`, pero **Space Mono no se pide en ningún
> `<link>`**, así que siempre ha caído a `monospace`. No se ha tocado (tocarlo sería
> un cambio visual). Queda anotado para la sesión de tipografía.

### Prueba byte a byte: Google descarta Satoshi

```
CON  Satoshi → status 200, 6857 bytes
SIN  Satoshi → status 200, 6857 bytes
diff → IDÉNTICOS
familias servidas en ambos casos: Instrument Serif, JetBrains Mono
```

Satoshi **no aparece en ninguna respuesta de Google**, ni antes ni después.

### Prueba: las familias servidas a cada página no cambian

Unión de todo lo que recibe una página (link global + link de página):

| Familia | Antes (pesos / estilos) | Después | Veredicto |
|---|---|---|---|
| Plus Jakarta Sans | 400, 500, 600, 700, 800 | idéntico | ✅ sin cambio |
| JetBrains Mono | 400, 500, 700 | idéntico | ✅ sin cambio |
| Instrument Serif | 400 normal, 400 italic | idéntico | ✅ sin cambio |
| Satoshi (Fontshare) | 400, 500, 700, 900 | idéntico | ✅ sin cambio |
| **DM Sans** | 400, 500, 600, 700, 800, 900 | **eliminada** | ✅ cero referencias, nunca pintó nada |

**Única familia que desaparece: DM Sans**, que no la usaba nadie.
Todas las demás conservan exactamente los mismos pesos y estilos.

### Recuento de lo eliminado

**Código fuente:**

```
 src/app/agentes/agentes.css                    |   3 +
 src/app/agentes/page.tsx                       | 820 +------------------------
 src/app/crm-para-agentes-de-obamacare/page.tsx |   2 +-
 src/app/layout.tsx                             |   2 +-
 src/app/recursos/layout.tsx                    |   2 +-
 src/app/recursos/recursos.css                  |   3 +
 6 files changed, 10 insertions(+), 822 deletions(-)
```

**818 líneas** de CSS muerto borradas (la constante `_CSS_REMOVED`).

**Peticiones de fuentes:** el número de peticiones CSS por página no cambia (siguen
siendo 3: global de Google, Fontshare, y la de página). Lo que se reduce es lo que
esas peticiones declaran:

| | `@font-face` declarados | CSS de fuentes descargado |
|---|---|---|
| Link global | 50 → 38 | 21 309 B → 16 023 B |
| Link de página (×3 rutas) | 16 → 4 | 6 857 B → 1 815 B |
| **Total por página** | **66 → 42 (−24, −36 %)** | **28 166 B → 17 838 B (−10 328 B, −37 %)** |

Desglose de los 24 `@font-face` eliminados: 12 de DM Sans (6 pesos × subsets) que
nunca se usaron, y 12 de JetBrains Mono duplicados en los links de página que el
link global ya servía con el mismo fichero.

---

## Pendiente para la sesión de tipografía (NO en este PR)

1. **Unificar los 3 `:root`** — hoy `agentes.css` y `recursos.css` duplican el mismo
   bloque de variables literal.
2. **`Space Mono` no carga** en `landing.css` — decidir si se pide o se cambia por
   JetBrains Mono, que ya está disponible globalmente.
3. **Decidir sobre Satoshi**: hoy llega por Fontshare mientras el resto del sitio usa
   Google Fonts. Es una decisión de diseño, no de limpieza.
4. Los `preconnect` a `fonts.googleapis.com` están en 2 de las 3 páginas
   (`recursos/layout.tsx` no lo tiene). Inconsistencia menor, sin impacto visual.
