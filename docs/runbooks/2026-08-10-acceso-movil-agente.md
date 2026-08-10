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

| Ruta | Resultado |
|---|---|
| `/` | `Para Agentes` visible en x=161–243; `Cotiza Gratis →` en 255–376; 3 anclas de sección en `display:none`; `scrollWidth` = 390, sin desbordamiento |
| `/agentes` | `Iniciar Sesión` visible en 172–252; `Crear Cuenta →` en 262–376; 4 anclas ocultas; sin desbordamiento |
| `/crm-para-agentes-de-obamacare` | logo 14–132; `Iniciar Sesión` 174–254; `Crear cuenta →` 264–376; sin colisión ni desbordamiento |
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

## Qué quedó fuera, y por qué

| Defecto | Por qué no entra |
|---|---|
| `isAdmin` ausente en 5 de las 6 páginas que montan el header | Bug real de navegación, pero de permisos, no de responsive. Mezclarlo diluye la verificación del desbloqueo. **Registrado en `gotchas.md`** con las 5 rutas. |
| `top: 53` hardcodeado en la barra sticky de `LeadDetailClient.tsx:380` | Se rompe cuando el header envuelve en móvil. Arreglarlo requiere decidir un patrón nuevo (wrapper sticky o medición). |
| 10 grids inline de 3–4 columnas fijas que no colapsan | Trabajo de volumen y de legibilidad, no de acceso. Ilegible ≠ bloqueante. |
| Breakpoints inconsistentes entre hojas (640 / 760 / 768 / 900) sin tokens compartidos | Deuda documentada; unificarla ahora amplía la superficie de regresión del PR que más urge. |
| Menú hamburguesa / drawer | No existe ningún componente de este tipo en el repo (verificado por grep sobre todo `src/`). Construirlo es un PR propio, y **no hace falta para desbloquear el acceso**: conservar dos enlaces en el nav basta. |

El criterio del corte: el agente no se fue porque el dashboard se viera apretado — se fue
porque nunca pudo entrar.

## Seguimiento sugerido

1. Comprobar el header en el dashboard real con sesión admin y `agency_name` largo.
2. PR "densidad móvil del dashboard": `isAdmin`, `top: 53`, y los grids fijos.
