# 2026-08-11 — Sustituir emojis por iconos SVG en la ruta del demo del dashboard

## Resultado medible

Cuando Simón abre `/agentes/dashboard` y `/agentes/dashboard/share` delante de un agente,
ningún elemento de interfaz (botón, cabecera, badge, banner) muestra un emoji. Los mensajes
que el agente copia y pega a su cliente siguen llevando emoji, porque el destinatario es
un cliente final en WhatsApp.

## El criterio: icono de interfaz vs contenido

La regla que separa las dos categorías es **quién es el destinatario del glifo**:

- **ICONO DE INTERFAZ** — el glifo señala una acción, un objeto o un estado del sistema
  al *agente* que usa el software. Un emoji aquí lee como prototipo. **Se reemplaza.**
- **CONTENIDO** — el glifo vive dentro de un string que el agente copia y pega a su
  *cliente final*. Ahí el emoji es correcto y esperado: nadie manda un SVG por WhatsApp.
  **No se toca.**

El caso límite útil: en `ShareClient`, las tarjetas de mensajes tienen `label` y `text`.
El botón "Copiar" copia **`m.text`, nunca `m.label`** (`ShareClient.tsx:374`). Por eso el
`label` es interfaz (se reemplaza) y el `text` es contenido (intocable), aunque estén en
el mismo objeto y a dos líneas de distancia.

Segundo criterio, subordinado al anterior: **el mapeo es por FUNCIÓN, no por glifo.**
Ver `ShareClient.tsx:340`, donde un 🔗 etiquetaba un botón que **copia** en vez de abrir:
se mapeó a `Copy`, no a `ExternalLink`.

## Inventario y mapeo aplicado

44 emojis inventariados en los 6 archivos candidatos. **29 reemplazados, 15 conservados**
(6 por ser contenido, 9 por quedar los archivos fuera de alcance).

### page.tsx — 2

| Línea | Emoji | Contexto | Icono |
|---|---|---|---|
| 125 | ✅ | banner "¡Pago confirmado!" | `CheckCircle2` 16 |
| 139 | ⚠️ | banner "Cancelaste el pago" | `AlertTriangle` 16 |

### DashboardClient.tsx — 2

| Línea | Emoji | Contexto | Icono |
|---|---|---|---|
| 57 | `+` | botón "Agregar Cliente" | `Plus` 20 |
| 72 | ⬇ | botón "Exportar CSV" | `Download` 20 |

### LeadsTable.tsx — 6

| Línea | Emoji | Contexto | Icono |
|---|---|---|---|
| 222 | 📅 | fecha de seguimiento en la celda de nombre | `Calendar` 16 |
| 233 | 💬 | link a wa.me por lead, solo icono | `MessageCircle` 16 + `aria-label` |
| 286 | 🗑️ | botón borrar fila, solo icono | `Trash2` 16 + `aria-label` |
| 325 | 🗑️ | ilustración del modal de confirmación | `Trash2` 36 `strokeWidth={1.5}` |
| 342 | ⚡ | cabecera "Acción Hoy" | `Zap` 16 |
| 365 | 🗑️ | botón "Eliminar seleccionados" | `Trash2` 16 |

### BillingCard.tsx — 1

| Línea | Emoji | Contexto | Icono |
|---|---|---|---|
| 184 | 🎁 | banner "Early Adopter" | `Gift` 16 |

### ShareClient.tsx — 20 de interfaz

| Línea | Emoji | Contexto | Icono |
|---|---|---|---|
| 25-30 | 💬 👤 📸 🎵 📧 🖨️ | `UTM_PRESETS.icon` → botones "Link para X" | `MessageCircle` `Users` `Camera` `Music` `Mail` `Printer`, 16 |
| 181 | 🚀 | `<h1>` "Tu kit para compartir" | `Link2` 24 |
| 206 | 📋 | botón "Copiar link" (hero) | `Copy` 20 |
| 213 | 🔗 | botón "Abrir en pestaña nueva" | `ExternalLink` 20 |
| 302 | 💬 | botón "WhatsApp" | `MessageCircle` 20 |
| 307 | 📱 | botón "SMS" | `MessageSquare` 20 |
| 312 | 📧 | botón "Email" | `Mail` 20 |
| 319 | 🔗 | botón "Copiar link" | `Copy` 20 — **mapeo por función** |
| 328-332 | 💬 📱 📧 👤 🎵 | `label` de las tarjetas de mensajes | `MessageCircle` `MessageSquare` `Mail` `Users` `Music`, 16 |
| 383 | ⬇️ | botón "Descargar PDF imprimible" | `Download` 20 |

### ShareClient.tsx — 6 de CONTENIDO, INTOCABLES

| Línea | Emoji | String |
|---|---|---|
| 86 | 👋 | `messages.whatsapp` |
| 89 | 💙 ☕ 👉 | `messages.social` |
| 90 | 🏥 💚 | `messages.tiktok` |

Verificado byte a byte: el bloque `const messages = useMemo(...)` tiene el mismo
SHA-1 antes y después (`273e5fa0c5dcd3d7441a1b62e500890ff609e9f0`).

## Reglas de uso aplicadas

- Import nominal siempre (`import { Copy, Gift } from "lucide-react"`), nunca `import *`.
  Permite tree-shaking: solo entran al bundle los ~16 iconos usados.
- `strokeWidth={2}` en todos salvo la ilustración de 36.
- Color heredado (`currentColor`) en todos, sin excepción. No se pasó ni un color literal.
- Contenedor con `display:flex` + `align-items:center` + `gap`. Cero márgenes para empujar iconos.
- `flexShrink: 0` en todos los iconos, para que el flexbox no los deforme cuando el texto crece.
- `aria-hidden="true"` en todo icono acompañado de texto; `aria-label` en los dos controles
  que quedan sin texto visible (`LeadsTable.tsx:233` y `:286`).

### Escala de tamaños

| Tamaño | Uso | Ejemplo |
|---|---|---|
| 16 | icono inline junto a texto | banners, celdas de tabla, labels |
| 20 | icono de botón | Agregar Cliente, Exportar CSV, botones de compartir |
| 24 | cabecera de sección | `<h1>` de /share |
| 36 `strokeWidth={1.5}` | ilustración decorativa | modal de confirmación de borrado |

**Desviaciones deliberadas de la escala, y por qué.** La regla "no cambies ni un espaciado
ni la estructura del layout" tiene precedencia sobre la de tamaños cuando chocan. Tres casos
usan 16 donde la categoría "botón" pediría 20:

- `LeadsTable.tsx:286` — botón de borrar en cada fila. A 20 crecería cada fila de la tabla.
- `LeadsTable.tsx:365` — botón compacto de 12px en la barra de filtros. A 20 crecería la barra.
- `LeadsTable.tsx:342` — cabecera "Acción Hoy". Su texto es de 14px y el emoji original era
  de 16; a 24 la banda crecería ~5px. El 24 queda reservado para el `<h1>` de 26px de /share.

## Deuda que este PR deja abierta a propósito

**1. `ActivityTimeline.tsx` — 4 emojis (🔄 📝 📅 📧) sin reemplazar.**
Los cuatro viven dentro de un punto de 14px con `fontSize: 8` (`ActivityTimeline.tsx:60-67`).
Un SVG legible ahí exige agrandar el punto, que es exactamente el cambio de layout que este
PR prohíbe. Va a la sesión de rediseño visual, donde el punto se puede redimensionar con
criterio en vez de por accidente.

**2. `ActionToday.tsx` — archivo entero muerto, 5 emojis sin reemplazar.**
`grep -rn "ActionToday" .` (sin `node_modules`/`.next`) devuelve **una sola línea en todo el
repo: su propia declaración**. Ni un import estático, ni dinámico, ni referencia por string.
Duplica la sección "Acción Hoy" que hoy pinta `LeadsTable.tsx:339-353`, y es la misma trampa
que `_CSS_REMOVED`: código que parece vivo, se lee en las búsquedas y confunde el mapa mental
del repo. **Se borra en un PR aparte**, no aquí — este PR es iconos y nada más.

**3. Nota visual para revisar en el demo.** El ⚡ de "Acción Hoy" (`LeadsTable.tsx:342`) era
un emoji amarillo; el `Zap` hereda `currentColor`, que en esa cabecera resuelve a `#E2E8F0`
(el color del `<div>` raíz de `page.tsx`). Queda un rayo casi blanco junto al texto rojo
"Acción Hoy". Es lo que manda la regla de color heredado, pero conviene mirarlo en pantalla:
si no convence, la corrección limpia es poner `color` en el contenedor de la cabecera, no en
el icono.

**4. Fuera de alcance por decisión explícita.** `src/app/cotizar/**`, `src/app/page.tsx`,
`src/app/agentes/page.tsx` tienen ~95 emojis más. Son superficie de consumidor, no de agente:
el criterio de arriba no aplica igual y la decisión es distinta. Sesión aparte.

**5. El `✓` (U+2713) de `BillingCard.tsx:319` y `:342` se queda.** Es carácter tipográfico,
no emoji: se renderiza igual en todo sistema operativo y no es parte del problema.

## Guion ejecutado y verificación

| # | Paso | Verificación esperada | Resultado |
|---|---|---|---|
| 0 | Inventariar y clasificar los emojis, sin editar | inventario completo con archivo/línea/categoría | 44 emojis, 38 interfaz / 6 contenido, 7 dudosos reportados a Simón |
| 1 | Verificar que `ActionToday` está muerto | `grep` en todo el repo, incluido dinámico | 1 sola aparición: su propia declaración. Confirmado muerto |
| 2 | Verificar consumidores de `UTM_PRESETS` antes de cambiar su tipo | ningún consumidor fuera de ShareClient | `const`/`type` privados del módulo, 3 usos internos, ninguno lee `.icon` salvo el render |
| 3 | Reemplazar los 29 emojis de interfaz | 0 emojis en los 5 archivos en alcance | 0. Confirmado con regex Unicode `\p{Extended_Pictographic}` |
| 4 | `npx tsc --noEmit` | 0 errores en `src/` | 0 en `src/`. Los 3 errores restantes son de `.next/dev/types/validator.ts`, **preexistentes** — verificado reproduciéndolos con el árbol limpio en HEAD |
| 5 | `npm test` | suite verde | **717/717 en 93 archivos** |
| 6 | `npm run build` | compila | `✓ Compiled successfully in 11.6s` |
| 7 | Probar que el contenido no se movió | diff vacío de los templates | **idéntico byte a byte**, mismo SHA-1 |
| 8 | Medir delta de bundle | delta acotado | **+9 484 bytes (+9.26 kB, +0.35 %)** sobre el JS de cliente |

### Nota sobre la medición del bundle

El guion original pedía el delta "según la salida de `next build`". **Next 16.1.6 ya no
imprime columnas de tamaño por ruta** en esa tabla, así que ese dato no existe en la salida.
La medición se hizo construyendo dos veces —línea base con `git stash`, y con los cambios— y
sumando el tamaño de los 42 chunks JS emitidos en `.next/static`:

```
antes  : 2 696 062 bytes (2632.87 kB)
después: 2 705 546 bytes (2642.13 kB)
delta  : +9 484 bytes (+9.26 kB, +0.35 %)
```

Son ~16 iconos SVG a ~590 bytes cada uno. El import nominal hace su trabajo: entra solo lo
que se usa, no las ~1 600 formas del paquete.
