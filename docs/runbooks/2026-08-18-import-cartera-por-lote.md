# 18 ago 2026 — El importador de clientes no aceptaba una cartera real

## Síntoma

Un agente sube el CSV de su cartera y la pantalla se queda en "Importando...".
A veces entran unos pocos clientes, a veces ninguno, sin ningún mensaje.

## Causa raíz

`POST /api/leads/import` aceptaba **un cliente por petición HTTP**, y
`ImportClient.handleImport()` recorría el CSV fila por fila disparando un
`fetch` por cada una. El endpoint tiene rate limit de **10 peticiones por
hora por usuario**, así que una cartera de 200 clientes generaba 200
peticiones y el límite mataba todo a partir de la décima.

Medido en producción, ventana de 48 h antes del arreglo:

| Estado | Peticiones |
|---|---|
| 200 OK | 20 |
| 429 Too Many Requests | 213 (91,4 %) |

Tres defectos encadenados lo volvían invisible:

1. **El límite era por instancia, no por usuario.** `src/lib/rate-limit.ts`
   guarda el contador en un `Map` en memoria del proceso. Cada instancia
   lambda lleva su propia cuenta, así que entraron 20 filas con un límite de
   10: al menos dos instancias sirvieron en paralelo. Por eso el resultado
   cambiaba entre intentos.
2. **El cliente no distinguía un 429 de un error de datos.** Todo lo que no
   trajera `success` sumaba al contador de "errores" sin mostrar el motivo.
3. **No había progreso.** El botón decía "Importando... (N registros)" durante
   todo el recorrido, sin avanzar. Desde afuera parecía colgado.

## Dos defectos silenciosos que salieron en el camino

**El parser partía por comas crudas.** `ImportClient.tsx` hacía
`line.split(",")`, así que cualquier campo entrecomillado con una coma dentro
—`"Lopez, Maria Jose"`, `"Ambetter - Clarity Silver, con dental"`— corría todas
las columnas siguientes una posición. Sobre un archivo sintético de 200 filas
tipo HealthSherpa, **21 primas (10,5 %) quedaban corruptas** y nadie se
enteraba: entraban a la base como si nada. La rama `feature/modulo-oep-cartera`
ya tenía un parser RFC-4180 probado y su comentario advertía de no reusar el
viejo; ese parser se porta aquí adaptado a la forma de `leads`.

**La fecha de renovación nacía vencida.** La regla era
`enrollment_date + 365 días`, es decir el PRIMER aniversario de la fecha
efectiva original. Un cliente con vigencia 2023-01-01 quedaba con renovación
2024-01-01 — una fecha en el pasado. `/api/cron/renewals` compara
`renewal_date == hoy + {60,30,15}` con igualdad exacta, así que esos clientes
**nunca** iban a recibir recordatorio, que es justamente para lo que un agente
sube su cartera antes del OEP. Los planes ACA corren de enero a diciembre: la
renovación correcta es el 1 de enero siguiente, sin importar cuándo empezó la
póliza.

## Qué cambia

- `POST /api/leads/import` acepta `{ rows: [...] }` — una petición por archivo,
  hasta 1000 filas (413 con mensaje si se pasa, nunca truncado en silencio).
  Un dedupe con una sola consulta contra los teléfonos que el agente ya tiene,
  más dedupe dentro del propio archivo, e inserción en bloques de 500.
  La forma de un solo cliente se sigue aceptando sin cambios.
- Al batchear, el limitador deja de ser un problema: 10 peticiones por hora
  ahora significan 10 importaciones por hora, y una petición no puede
  repartirse entre instancias. El `Map` en memoria sigue en el backlog para
  migrar a Redis, pero ya no bloquea esta ruta.
- `src/lib/leads/import-csv.ts` — parser RFC-4180 (comas entrecomilladas,
  comillas escapadas, saltos de línea dentro del campo, CRLF, BOM) y mapeo de
  encabezados ES/EN. Normaliza el teléfono quitando el código de país para que
  el dedupe sea estable.
- `src/lib/leads/renewal-date.ts` — `nextRenewalDate()`, más coerción de fecha,
  prima y estado. Un cliente marcado `Active` / `Activo` / `In Force` entra
  como `enrolled`, no como lead nuevo.
- La pantalla muestra qué columnas detectó, cuáles ignoró y qué campos no
  encontró; avanza con progreso real; y cuando algo falla dice qué pasó y qué
  hacer. Las filas que no entraron se listan por número de línea y motivo.
- Un `.xlsx` se detecta por extensión y se explica cómo guardarlo como CSV, en
  vez de leerlo como texto y mostrar una vista previa vacía.

## Privacidad

La respuesta del endpoint devuelve solo número de línea y código de motivo
(`missing_phone`, `duplicate`, …), nunca el valor del campo, para que ningún
dato del cliente llegue a logs, Sentry o PostHog. Hay un test que lo afirma.

## Gate

- 292 tests en verde (baseline 239, +53 nuevos: 33 de parser y fechas, 20 de
  ruta, incluido un E2E sobre un archivo de ejemplo con comas entrecomilladas,
  comillas escapadas, teléfono con código de país, fila repetida, fila sin
  nombre, fila sin teléfono y fila en blanco).
- `tsc --noEmit` limpio, `next build` exit 0.

## Pendiente

- Leer `.xlsx` en el navegador. El paquete `xlsx` de npm está congelado en
  0.18.5, con la corrección de prototype pollution (CVE-2023-30533) publicada
  solo fuera del registro; no se añade aquí. Alternativa a evaluar: `exceljs`.
- Cupo de plan: el endpoint no valida el límite de leads del plan del agente.
  Una cartera de 200 consume el cupo Pro completo. Decisión de producto
  pendiente: si el book of business debe vivir en `leads` o en
  `portfolio_clients` (módulo Cartera, PR #61).
