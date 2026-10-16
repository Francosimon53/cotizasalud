# Runbook · Pre-carta protegida e ID de HealthSherpa en el perfil

**Fecha:** 2026-10-16
**Rama:** `fix/precarta-y-id-healthsherpa` (sale de `main` después del PR #73)
**Alcance:** la pre-carta del cotizador (`POST /api/precarta-pdf`) y el ID de HealthSherpa de cada agente. Sin migraciones: la columna `agents.healthsherpa_agent_id` ya existía.

## Contexto

Dos hallazgos del 16-oct-2026, después de cerrar la Fase 0 del OEP 2027 (PR #73):

1. **La pre-carta del cotizador.** El bucket `precarta-pdfs` era público: 72 PDFs con nombre, fecha de nacimiento y firma de clientes, del 15-abr al 2-oct-2026, abiertos a quien tuviera el enlace. El bucket se cerró ese día (`public = false`, verificado en la base; los 72 archivos siguen ahí). Además, el `POST` no tenía límite de pedidos ni topes de tamaño, y devolvía el PDF y una URL pública que el cotizador no usaba. Ojo: esos PDFs son el **único registro** de la firma de la pre-carta (la firma del paso 0 no se guarda en el lead; la del lead es otra, la del paso de contacto). Por eso el PDF se **sigue guardando**, ahora en privado, y los 72 viejos no se deben borrar.
2. **El ID de HealthSherpa.** El enlace de cotización del Mercado (PR #73) usa `_agent_id`, que en HealthSherpa es el nombre de usuario del agente (el que aparece en su enlace de marketing, `?_agent_id=juan-perez`), no el NPN. Con el NPN, HealthSherpa redirige a su portada: probado el 16-oct con el enlace de Delbert. De 8 agentes, solo uno tenía valor en `healthsherpa_agent_id` y era su NPN; los demás caían al NPN por código. No había forma de cargarlo desde la app.

## Resultado medible

1. `POST /api/precarta-pdf` responde 429 pasado el límite, 413 con firmas gigantes, 400 con datos mal formados, y nunca devuelve el PDF ni una URL. El PDF se guarda en el bucket privado.
2. Ningún enlace de HealthSherpa se arma con el NPN. Sin ID válido, los botones de HealthSherpa no aparecen y, si al lead no le falta nada más, aparece "Agrega tu enlace de HealthSherpa en tu perfil".
3. El agente pega su enlace de marketing en **Mi Perfil** y la app guarda el ID que viene después de `_agent_id=`.

## Guion ejecutado

| # | Paso | Verificación | Resultado |
|---|------|--------------|-----------|
| 0 | Investigación de solo lectura: quién usa el `POST`, qué devuelve, dónde vive la firma de la pre-carta, cuántos agentes tienen ID de HealthSherpa | Lista cerrada de llamadas y datos | ✅ Un solo llamador (`PreCarta.tsx`), que ignora el PDF y la URL. La firma del paso 0 solo vive en el PDF guardado. 8 agentes, 1 con ID y es el NPN |
| 1 | `parseHealthSherpaAgentId` y `resolveHealthSherpaAgentId` en `src/lib/healthsherpa-link.ts` | Pruebas: enlace completo, sin https, ID suelto, sin `_agent_id`, otro dominio, caracteres raros, igual al NPN | ✅ |
| 2 | Ficha del cliente y vista de inscripción: sin caer al NPN; aviso para agregar el enlace cuando es lo único que falta | `tsc` sin errores | ✅ |
| 3 | Mi Perfil: campo "Tu enlace de HealthSherpa" con el ID detectado en vivo; `PATCH /api/agents/profile` valida y guarda (vacío borra; si el campo no viene, no se toca) | Pruebas del `PATCH` | ✅ |
| 4 | `POST /api/precarta-pdf`: límite de 10 pedidos cada 5 minutos por IP, topes (nombre 120, firma 500.000 caracteres, fecha AAAA-MM-DD), guarda en el bucket privado y responde solo `{ success, fileName }` | Pruebas del `POST` y del `GET` | ✅ |
| 5 | `PreCarta.tsx` y `cotizar/page.tsx`: fuera el manejo de la URL pública muerta | Búsqueda de `storageUrl` vacía | ✅ |
| 6 | Puerta: `tsc --noEmit`, `vitest`, `next build` | Los tres en verde | ✅ 403 pruebas en 42 archivos (antes 379 en 40) |

## Reporte de verificación

| Esperado | Obtenido |
|---|---|
| `tsc --noEmit` sin errores | ✅ |
| `vitest` en verde | ✅ 403 / 403 |
| `next build` | ✅ Compila (en local con valores de relleno para Stripe y Supabase; en Vercel usa los reales) |
| Sin `storageUrl` ni `pdfStorageUrl` en `src` | ✅ |
| Ningún `healthsherpa_agent_id \|\| npn` | ✅ |

## Después del merge

- Cada agente pega su enlace de HealthSherpa en Mi Perfil. Para Delbert: hoy tiene guardado su NPN, que la app ya trata como vacío.
- Probar con un enlace real: la cotización del Mercado debe abrirse con los datos puestos y a nombre del agente.
- Pendiente para más adelante: guardar en el lead la ruta del PDF de la pre-carta (hoy se reconoce solo por nombre y fecha en el nombre del archivo).

## Lección

Antes de quitar un archivo "que nadie usa", hay que preguntar si es el único registro de algo. La URL pública no la usaba nadie; el archivo sí importaba, porque era la única prueba de la firma. Y un identificador "parecido" (el NPN) en el lugar de otro (el usuario de HealthSherpa) no falla con error: falla en silencio, mandando al cliente a una portada.
