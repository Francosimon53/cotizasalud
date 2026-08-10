# Acceso móvil del agente — desbloqueo de la vía de entrada

**Fecha:** 2026-08-10
**Rama:** `fix/acceso-movil-agente`
**Tipo:** corrección de presentación y navegación. No toca auth ni sesión.

## Problema

Un agente que abría `enrollsalud.com` desde el teléfono no podía iniciar sesión. Era el
bloqueador número uno del producto: el early adopter principal abandonó la plataforma aquí,
sin llegar nunca a usar nada de lo que había más adelante.

Tres capas de defecto, encadenadas:

1. **`/agentes` escondía la barra de navegación completa bajo 900px.**
   `agentes.css:986` aplicaba `.ag-nav-links { display: none; }`, y ese contenedor incluía
   tanto `Iniciar Sesión` como `Crear Cuenta →`. La página cuyo público *son* los agentes
   no ofrecía ni login ni registro en móvil. El breakpoint de 900px también se llevaba
   tablets y teléfono en horizontal.
2. **La landing nunca tuvo enlace de login en el nav**, y `landing.css:26` ocultaba además
   el enlace `/agentes` bajo 768px. El único acceso era `Portal Agentes` en el footer,
   entre enlaces legales, tras ~1.300 líneas de página.
3. **`DashboardHeader` desbordaba horizontalmente en cualquier teléfono.** Estaba escrito
   100% con estilos inline, sin una sola clase, así que ninguna media query podía alcanzarlo
   (la única media query de `agentes.css` vivía en la línea 974 y no tenía dónde engancharse).
   Ancho mínimo estimado ~790px para un agente admin contra 390px de viewport: `Perfil` y
   `Salir` quedaban fuera de pantalla.

Camino real que tenía el agente en móvil antes de este cambio:

```
enrollsalud.com → nav sin login → hero "🏢 Soy Agente" → /agentes → nav completo oculto
                → scroll de toda la página hasta el footer → "Portal Agentes"
```

## Criterio de aceptación

> Desde 390px de ancho, un agente que teclea `enrollsalud.com` llega a la pantalla de login
> en ≤2 toques sin hacer scroll al footer. Una vez dentro, los 6 botones del header son
> visibles y alcanzables sin scroll horizontal ni apilarse en más de 2 filas.

## Qué se arregló

### #1 · `/agentes` conserva las dos vías de entrada en móvil

`src/app/agentes/agentes.css` — la regla de la media query de 900px pasa de ocultar el
contenedor entero a ocultar sólo los anclas de sección, con la misma forma que ya usaba
`landing.css:26`:

```css
.ag-nav-links a:not(.ag-nav-cta):not(.ag-nav-login) { display: none; }
```

Se añaden ajustes de densidad (`gap`, padding del nav, tamaño del logo y del CTA) para que
logo + `Iniciar Sesión` + `Crear Cuenta →` quepan sin desbordar a 390px.

`src/app/agentes/page.tsx:1021` — el enlace de login pasa de estilo inline a
`className="ag-nav-login"`, para que la media query pueda excluirlo. La apariencia no cambia:
la clase reproduce el `color: #10b981` (ahora `var(--accent)`) y el `font-weight: 700`.

### #2 · La landing conserva la puerta al portal de agentes

`src/app/page.tsx:47` — el enlace `/agentes` recibe `className="es-nav-agentes"`.
`src/app/landing.css:26` — el selector pasa a `:not(.es-nav-cta):not(.es-nav-agentes)`, más
ajustes de densidad para 768px.

No se añadió ningún CTA que compita con `Cotiza Gratis →`: la landing sigue siendo del
consumidor final, y `Para Agentes` es un enlace de nav secundario, no una llamada a la acción.

### #3 · `DashboardHeader` migrado a clases

`src/app/agentes/dashboard/DashboardHeader.tsx` — se eliminan todos los estilos inline en
favor de `.dh-header`, `.dh-brand`, `.dh-logo`, `.dh-brand-text`, `.dh-brand-name`,
`.dh-brand-sub`, `.dh-nav`, `.dh-btn`, `.dh-btn-admin`. El componente queda sólo con lógica.

`src/app/agentes/agentes.css` — nuevo bloque `DASHBOARD HEADER` con las reglas base
(equivalentes 1:1 a los inline anteriores) y una media query a 760px que:

- envuelve el grupo de botones en su propia línea (`flex: 1 1 100%` + `flex-wrap: wrap`);
- recorta el nombre de agencia con `min-width: 0` + `text-overflow: ellipsis`;
- oculta el subtítulo "Panel de Agente", redundante en móvil;
- reduce padding, `gap` y tipografía de los botones.

Esto era posible sin infraestructura nueva porque **las 6 páginas que renderizan el header ya
importaban `agentes.css`**. La migración a clases es justamente lo que elimina la causa de que
la media query existente no pudiera alcanzar el header.

### #1b · Seguro de ancho: el wordmark se oculta bajo 400px

La primera versión dejaba el nav de `/agentes` con sólo ~14px de holgura a 390px. Como el
iPhone SE es de **375px** y ésta es la vía de entrada principal del agente, el margen era
insuficiente: cualquier etiqueta que se alargue en el futuro rompía el nav.

Bajo **400px** se oculta el wordmark "EnrollSalud" y queda sólo el icono, que sigue siendo el
mismo enlace a `/`. Se eligió 400px por dejar el peor caso (401px, wordmark ya visible) con
holgura suficiente — medido en 39–53px — en vez de justo en el límite.

Aplicado a las tres superficies tocadas para que el comportamiento sea consistente, no sólo en
la que iba justa:

- `landing.css` — `@media(max-width:400px){.es-nav-logo .text{display:none}}`
- `agentes.css` — `@media (max-width: 400px) { .ag-nav-logo-text { display: none; } }`,
  que cubre `/agentes` y la página CRM porque comparten `.ag-nav`.

En la landing el wordmark era un nodo de texto suelto dentro del `<Link>`, sin elemento donde
enganchar, así que se envolvió en `<span className="text">`.

Los tres enlaces de logo reciben `aria-label="EnrollSalud — Inicio"`: `display: none` saca el
texto también del árbol de accesibilidad, así que sin el label el enlace se quedaría con sólo
un icono como nombre accesible.

### #4 · Página CRM SEO

`src/app/crm-para-agentes-de-obamacare/page.tsx:101` — se añade `Iniciar Sesión` al nav.
Antes sólo ofrecía `Crear cuenta →`, inútil para un agente que ya tiene cuenta. El resto se
resuelve solo al compartir `.ag-nav-links` con #1.

## Verificación

Gate:

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 31 archivos, 239 tests, todos pasan |
| `STRIPE_SECRET_KEY=sk_test_dummy_for_build npm run build` | exit 0 |

Runtime a 390px de viewport exactos. Chrome no permite reducir la ventana por debajo de
~520px de viewport en macOS, así que se midió dentro de un iframe de 390px, que crea su propio
viewport para las media queries. `X-Frame-Options: DENY` (`next.config.ts:28`) impide framear
las rutas por URL, de modo que se usó `srcdoc` con el HTML servido más un `<base>`.

Ninguna de las tres rutas públicas desborda a 375, 390, 401 ni 430px. La holgura relevante es
el hueco entre el logo y el primer enlace del nav, porque el contenedor es `space-between`
(los 14px que sobran a la derecha son el padding del propio nav, no margen aprovechable):

| Ruta | 375px | 390px | 401px | 430px |
|---|---|---|---|---|
| `/` | 104px | 119px | 39px | 68px |
| `/agentes` | 113px | 128px | 51px | 80px |
| `/crm-para-agentes-de-obamacare` | 115px | 130px | 53px | 82px |

A 375 y 390px el wordmark está oculto; a 401 y 430px vuelve a estar visible — de ahí que la
holgura baje al cruzar el breakpoint y luego crezca de nuevo. El peor caso de todo el rango es
39px a 401px en la landing, contra los ~14px que había antes de este ajuste.

En las tres rutas y a los cuatro anchos se ven exactamente los dos enlaces esperados, con los
anclas de sección en `display:none`.

| Superficie | Resultado |
|---|---|
| `DashboardHeader` | admin (6 botones) y agente normal (5) en **2 filas de botones**; borde derecho máximo 378 ≤ 390; sin scroll horizontal; nombre de agencia recortado con elipsis |

El header se verificó con un harness que carga el `agentes.css` real y el markup exacto del
componente, **no contra una sesión viva**: este working copy no tiene `.env.local` (sólo
`.env.example`), y sin credenciales de Supabase el middleware devuelve 500 en
`/agentes/dashboard`. Al ser un cambio puramente de CSS sobre markup estático, el harness
ejercita exactamente lo que se modificó, pero **queda pendiente una comprobación en el
dashboard real con sesión**, preferiblemente con una cuenta admin y un `agency_name` largo.

Una primera medición del header se descartó por inválida: el harness no había cargado la hoja
de estilos y midió botones sin estilo. Se repitió confirmando antes que
`getComputedStyle(.dh-header)` devolviera `display:flex` y `flex-wrap:wrap`.

## Segunda ronda: el recorte en el iPhone no era el header

La verificación en dispositivo real falló pese a que el gate y las medidas daban verde. En
`/import`, `/renewals`, `/profile` y `/share` la página aparecía recortada por ambos lados,
con scroll horizontal: `"Importar Clientes"` se leía `"mportar Clientes"` y el icono `ES`
salía partido por la mitad.

### Causa: auto-zoom de Safari en iOS

iOS Safari **hace zoom automático al enfocar un `input`, `select` o `textarea` cuyo
`font-size` sea menor que 16px**. Es comportamiento de plataforma, no un bug del sitio. Una
vez que hace zoom, **se queda**: el viewport visual queda más pequeño que el de layout, y toda
página posterior de la sesión se ve recortada por ambos lados.

Secuencia real: landing (perfecta, ningún campo tocado) → `/agentes/login`, se enfoca el campo
de correo, que estaba a `fontSize: 15` → zoom → todo el dashboard recortado a partir de ahí.

Esto explica de golpe los cuatro síntomas que no encajaban:

- El recorte simétrico izquierda y derecha: no era desbordamiento, era el viewport visual
  reducido.
- Por qué el header medía correcto: **medía correcto**. Nunca fue el header.
- Por qué Chrome de escritorio no lo reproduce: no hace auto-zoom al enfocar.
- Por qué la landing se veía bien: es lo que se visita *antes* de tocar un campo.

### Qué se cambió

Los 40 controles de las superficies del agente que disparaban el zoom pasan a `font-size: 16`.
Los seis restantes (`file`, `checkbox` ×2, `color` ×2, `button`) están exentos: no disparan
zoom. El `<select>` de estado por fila de `LeadsTable` venía de 11px y además llevaba
`padding` propio, así que se le redujo el padding para compensar el salto.

Todos los campos del proyecto se estilan **inline**, sin una sola clase CSS: no hay ninguna
regla para `input`/`select`/`textarea` en `agentes.css`, `globals.css` ni `landing.css`. Por
eso el arreglo no pudo hacerse desde una hoja — el estilo inline gana siempre salvo con
`!important` — y se hizo en los diez objetos de estilo que son la fuente de verdad.

**No se tocó el viewport.** Bloquear el zoom con `maximum-scale=1` o `user-scalable=no`
habría "arreglado" el síntoma y es la receta que circula por internet, pero es una barrera de
accesibilidad para agentes con vista cansada. El arreglo es el tamaño de fuente. Se verificó
además que el repo no tenía ya ningún intento de bloquear el zoom: cero coincidencias de
`maximum-scale|user-scalable|minimum-scale` en todo `src/`.

### GOTCHA — el auto-zoom de iOS no es reproducible fuera del dispositivo

Ninguna de estas herramientas lo detecta:

| Método | Por qué falla |
|---|---|
| Chrome de escritorio | No hace auto-zoom al enfocar un campo |
| Emulación de dispositivo de DevTools | Simula el tamaño del viewport, no el comportamiento de zoom de Safari |
| Harness con iframe `srcdoc` | El iframe define su propio viewport; el zoom del padre no le llega |
| Ventana popup con viewport real | Sigue siendo Blink; el auto-zoom es de WebKit |
| `tsc`, tests, `next build` | Un `fontSize: 15` compila igual de bien que un 16 |

**La única verificación válida es dispositivo real, y hay que tocar un campo.** Abrir la página
y mirarla no basta: el zoom se dispara al enfocar el input, no al cargar. Cualquier revisión
futura de responsive en formularios tiene que incluir ese paso explícito.

Corolario para el método: un harness que solo contiene el componente bajo prueba no puede
detectar problemas causados por el resto de la página ni por el estado del navegador. El
primer harness de este PR contenía únicamente el header, y por eso dio verde sobre algo que
en el teléfono estaba roto.

### Defecto #5, resuelto en el mismo commit

`isAdmin` era un prop que solo pasaba 1 de las 6 páginas que montan el header, así que el botón
"Equipo" desaparecía al salir del panel principal. Se resuelve ahora dentro del propio
`DashboardHeader` a partir del slug, y `ADMIN_SLUGS` —que estaba duplicado en `dashboard/page.tsx`,
`team/page.tsx` y `api/admin/toggle-agent/route.ts`— pasa a `src/lib/admin-slugs.ts` como fuente
única.

Efecto secundario previsto y aceptado: al aparecer "Equipo" en las cinco sub-páginas, el grupo
de botones sube de 351px a ~417px y pasará a dos filas en ellas. Cumple el criterio de
aceptación (≤2 filas) y por eso entra en el mismo commit que el arreglo del zoom, no después.

## DEUDA PRIORITARIA — el cotizador público tiene el mismo defecto, y es peor

`src/app/cotizar/` sufre exactamente el mismo auto-zoom, vía la constante compartida
`S` en `page.tsx:253-254` (`S.input` y `S.select`, ambos a `fontSize: 15`).

| Fichero | Controles | `font-size` |
|---|---|---|
| `cotizar/page.tsx` | 21 | 15 |
| `DobSelect.tsx` | 3 selects | 15 (recibe `S.select`) |
| `PreCarta.tsx` | 2 | 15 (`S.input`) |
| `CMSConsentForm.tsx:301` | 1 (firma) | 18 ✅ el único a salvo |

**26 de 27 controles disparan auto-zoom.** El cliente final rellena ese formulario entero desde
el teléfono: toca el primer campo, Safari hace zoom, y **el resto del flujo —incluidos los
resultados de planes y la firma CMS— se ve recortado con scroll horizontal**.

Esto es superficie de conversión del canal principal del producto, y es sospechoso de estar
degradando la conversión de forma silenciosa desde siempre. **Es el PR siguiente.** El arreglo
es de dos líneas (la constante `S`), pero merece su propia verificación en dispositivo real
recorriendo el formulario completo, y por eso no entra aquí.

## Qué quedó fuera, y por qué

| Defecto | Por qué no entra |
|---|---|
| ~~`isAdmin` ausente en 5 de las 6 páginas~~ | **Ya no queda fuera**: se arregló en la segunda ronda, ver arriba. La observación en dispositivo lo confirmó en vivo. |
| Cotizador público (`src/app/cotizar/`) con el mismo auto-zoom | Superficie de conversión del cliente final. Arreglo de dos líneas, pero necesita su propia verificación en dispositivo recorriendo el formulario entero. **PR siguiente, prioritario.** |
| `top: 53` hardcodeado en la barra sticky de `LeadDetailClient.tsx:380` | Se rompe cuando el header envuelve en móvil. Arreglarlo requiere decidir un patrón nuevo (wrapper sticky o medición). |
| 10 grids inline de 3–4 columnas fijas que no colapsan | Trabajo de volumen y de legibilidad, no de acceso. Ilegible ≠ bloqueante. |
| Breakpoints inconsistentes entre hojas (640 / 760 / 768 / 900) sin tokens compartidos | Deuda documentada; unificarla ahora amplía la superficie de regresión del PR que más urge. |
| Menú hamburguesa / drawer | No existe ningún componente de este tipo en el repo (verificado por grep sobre todo `src/`). Construirlo es un PR propio, y **no hace falta para desbloquear el acceso**: conservar dos enlaces en el nav basta. |

El criterio del corte: el agente no se fue porque el dashboard se viera apretado — se fue
porque nunca pudo entrar.

## Seguimiento sugerido

1. Comprobar el header en el dashboard real con sesión admin y `agency_name` largo.
2. PR "densidad móvil del dashboard": `isAdmin`, `top: 53`, y los grids fijos.
