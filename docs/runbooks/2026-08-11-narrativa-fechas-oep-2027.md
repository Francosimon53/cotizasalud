# Runbook · Narrativa de fechas del OEP 2027

**Fecha:** 2026-08-11
**Rama:** `fix/oep-2027-fechas`
**Alcance:** solo copy y la constante que lo alimenta. Cero cambios de diseño, estilos, layout o lógica.

## Contexto

La regla de CMS que acortaba el OEP a un cierre el 15-dic-2026 fue **anulada por un juez en junio de 2026**. En **agosto de 2026 HHS aclaró** que en los estados que usan HealthCare.gov (incluida Florida) el período va del **1 de noviembre de 2026 al 15 de enero de 2027**. El 15 de diciembre sigue siendo el límite para que la cobertura empiece el 1 de enero; quien se inscribe después arranca el 1 de febrero.

El número **45 no está mal** — del 1 de noviembre al 15 de diciembre hay 45 días. Lo que estaba mal era la frase a la que estaba pegado. Se reencuadra, no se borra.

## Resultado medible

En el mundo real la solución funcionó si, tras el deploy:

1. Ninguna página pública afirma que el OEP dura, se acorta a, o termina en 45 días / el 15 de diciembre.
2. `llms.txt` y el JSON-LD indexable describen las **dos** fechas (15-dic para cobertura de enero, 15-ene cierre del período).
3. El argumento comercial de urgencia se conserva: la ventana de 45 días sigue siendo el gancho, ahora atada a "cobertura desde el 1 de enero".

## Guion ejecutado

| # | Paso | Verificación | Resultado |
|---|------|--------------|-----------|
| 0 | Investigación read-only: leer `aca-stats.ts`, todos los bloques de copy, grep de fechas, auditar JSON-LD | Lista cerrada de ocurrencias; nada que contradiga el encuadre nuevo | ✅ 13 callsites de constante + 6 strings hardcodeados + 3 "OEP corto". `api/plans/route.ts:77` ya asumía Nov 1 – Jan 15 |
| 1 | En `aca-stats.ts`: eliminar `oepFin` y `oepDias`; agregar `oepLimiteEnero`, `oepFinPeriodo`, `diasHastaCoberturaEnero`; documentar la distinción en el comentario de cabecera | `npx tsc --noEmit` lista todos los callsites viejos como error | ✅ 13 errores `TS2339`, usados como checklist |
| 2 | Reescribir copy en 8 archivos aplicando la regla dura | Cada frase prohibida sustituida por el encuadre correcto | ✅ ver tabla de archivos |
| 3 | Gate: `tsc --noEmit` + `npm test` + `npm run build` + greps de residuales | Los tres verdes; greps vacíos | ✅ 0 errores en `src/`, 717 tests en 93 archivos, build OK, greps vacíos |
| 4 | Commit único + PR, sin merge | URL del PR | ✅ |

### Nota sobre el paso 3

`node_modules` estaba vacío al empezar; hubo que correr `npm ci` antes del gate.

`npx tsc --noEmit` deja 3 errores en `.next/dev/types/validator.ts` que apuntan a rutas de cartera (`dashboard/cartera`, `api/cartera`) inexistentes en esta rama. Son **caché rancio y gitignored** de una sesión `next dev` sobre la rama de PR #61 — pre-existentes y ajenos a este cambio. Los errores en `src/` son **0**.

## Archivos tocados (8)

| Archivo | Cambio |
|---|---|
| `src/lib/aca-stats.ts` | Fuente de verdad: `oepFin`/`oepDias` → `oepLimiteEnero`/`oepFinPeriodo`/`diasHastaCoberturaEnero` + comentario explicando la distinción |
| `src/app/page.tsx` | Badge del hero |
| `src/app/agentes/page.tsx` | Badge, stat-label, `<h4>` y párrafo de ROI (hardcodeados, no usan la constante) |
| `src/app/crm-para-agentes-de-obamacare/page.tsx` | Metadata ×3 (description/OG/Twitter), badge, hero, sección de categoría, 2 `<li>`, párrafo de stats, stat-label y CTA final |
| `src/app/recursos/como-conseguir-clientes-de-obamacare/page.tsx` | Intro, Táctica 5 y cierre de la metáfora |
| `src/app/recursos/elegibilidad-subsidio-aca-2027/page.tsx` | Paréntesis del `<blockquote>` |
| `src/app/recursos/articles.ts` | `description` del artículo — alimenta meta description **y** JSON-LD `Article` |
| `public/llms.txt` | Línea de contexto de mercado |

**No tocado a propósito:** `src/app/api/plans/route.ts` (su lógica ya asumía Nov 1 – Jan 15 y es correcta) y `como-conseguir-clientes-de-obamacare:58` ("un OEP persiguiendo leads" usa OEP como período genérico, no afirma duración).

## Reporte de verificación

| Esperado | Obtenido |
|---|---|
| `tsc --noEmit` sin errores en código del repo | ✅ 0 errores en `src/` (3 restantes en `.next/`, artefacto gitignored pre-existente) |
| `npm test` verde | ✅ 717 tests / 93 archivos, 0 fallos |
| `npm run build` verde | ✅ `Compiled successfully`, todas las rutas generadas |
| Cero referencias a `oepFin` / `oepDias` | ✅ grep vacío |
| Cero frases prohibidas | ✅ grep de `dura 45\|se acorta\|solo 45 días\|45 días de OEP\|Días de OEP\|OEP corto\|OEP se acorta\|período corto` vacío |
| Urgencia comercial conservada | ✅ los 45 días siguen siendo el gancho, ahora atados a la cobertura de enero |

## Lección

Una cifra correcta puede volverse una afirmación falsa por la frase que la envuelve. Al invalidarse una regla externa, el grep útil no es por el número sino por **la afirmación** — aquí, "dura/se acorta/termina". Anclar las fechas en una sola constante tipada hizo que eliminar las claves viejas produjera el checklist exacto de callsites; los strings hardcodeados de `/agentes` y `/` fue lo único que hubo que cazar a mano.
