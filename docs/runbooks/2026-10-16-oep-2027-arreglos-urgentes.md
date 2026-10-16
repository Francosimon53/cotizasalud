# 16 oct 2026 — OEP 2027, Fase 0: cinco arreglos urgentes antes del 1 de noviembre

Rama: `fix/oep-2027-arreglos-urgentes` (desde `main` en `1ca505b`). Un solo PR, sin merge.

## Contexto

El OEP 2027 abre el 1 de noviembre de 2026. Cinco defectos tenían consecuencia directa ese mes:

1. **Firmas inventadas.** `consent-pdf` imprimía `typed_signature || clientName`, caía a
   `lead.created_at` como fecha de firma e imprimía "Firmado digitalmente desde IP N/A".
   `precarta-pdf` hacía lo mismo con la fecha y la IP. Medido en la base (solo lectura):
   **286 de 290 leads no tienen ninguna evidencia de firma**. Hoy reciben un PDF con firma
   inventada. Solo 4 tienen firma real (fila en `consents` y firma legacy en el lead).
   Además, `GET /api/precarta-pdf` **no tenía autenticación**.
2. **HealthSherpa fuera del Mercado.** Los dos botones hacían POST a la ruta ICHRA
   `off_ex` de HealthSherpa: flujo fuera del Mercado, sin subsidio. Además mandaban
   `plan_year = new Date().getFullYear()`, que en noviembre y diciembre da 2026 con planes 2027.
3. **Subsidio 2027 a quien lo pierde.** El cotizador no mandaba `immigrationStatus` a
   `/api/plans`, y `determineAptcEligible` solo miraba `hasEmployerCoverage`.
4. **Recordatorios de renovación.** Salían a 60, 30 y 15 días del 1 de enero (2-nov, 2-dic y
   17-dic; el último, después del límite), con un WhatsApp que decía
   "Vi que te interesa el plan … por $?/mes". En la base había **127 renovaciones
   2027-01-01, todas sin enviar**. Las variables `TWILIO_*` están puestas en producción:
   sin arreglo, el 2-nov salían 127 mensajes con "$?".
5. **Borrado a medias.** El DELETE borraba `lead_activity` y luego el lead. Si el lead tenía
   consentimiento, la FK de `consents` (NO ACTION) hacía fallar el segundo paso con el
   historial ya perdido, y la interfaz navegaba igual.

### Paso 0 — lista cerrada (solo lectura)

| Pregunta | Resultado |
|---|---|
| Ruta ICHRA `off_ex` en src | `EnrollClient.tsx:62`, `LeadDetailClient.tsx:138` |
| `plan_year` en src | `EnrollClient.tsx:71`, `LeadDetailClient.tsx:147`, ambos con `getFullYear()` |
| `getFullYear` en src | Además: `plans/route.ts:88` (derivePlanYear), `cotizar/page.tsx` (edades y fecha de inicio), `DobSelect.tsx` y `LegalLayout.tsx` (©). Ninguno más necesita el año del plan |
| Firmas en PDF | consent-pdf `:81` (nombre como firma), `:86` (created_at), `:299` (IP N/A); precarta GET `:158` (created_at), `:168` (IP N/A) |
| `immigrationStatus` | Llega a `/api/leads/browse` y `/api/leads`. **No llegaba a `/api/plans`**. `refugee` no estaba en el menú |
| `ai_queries` | Pregunta, respuesta, tokens y modelo del asesor IA. Su único escritor (`logAIQuery` → `/api/ai-log`) **no se llama desde ningún lado**. **0 filas** |
| FKs hacia `leads` | `consents` NO ACTION · `ai_queries` NO ACTION · `lead_activity` CASCADE · `renewal_reminders` CASCADE · `ai_conversations` SET NULL |
| `renewal_reminders` por mes y día | 127 filas, todas 1-ene (2027-01-01). **0 que no sean 1 de enero** |
| `user_type` del consumidor (HealthSherpa, `?ask=`) | `consumer`: abre en modo consumidor, sin login de agente; el agente de registro es el de `_agent_id`. Confirmado |

### Decisiones de Simón durante la sesión

- **Cartera importada tarde:** siempre el primer recordatorio antes que los demás, un aviso
  por corrida. Pasado el 15-dic no sale el primero (su texto habla del 15): se marcan las tres
  banderas y queda la nota "Pasó el 15 de diciembre: si se inscribe antes del 15 de enero, la
  cobertura empieza el 1 de febrero."
- **precarta-pdf GET:** se cierra con autenticación y dueño en este PR.
- **Canal del primer recordatorio:** la tarea pedía Twilio al cliente, pero eso contradice los
  Términos publicados (`terms/page.tsx:167` y `:350`: "EnrollSalud NO envía comunicaciones a
  consumidores finales en nombre de los agentes"), la Política de privacidad (Twilio solo
  "a agentes") y la rama local `fix/cron-renewals-remove-twilio` del 6-ago. Decisión: **el
  agente lo manda**. El cron deja una nota interna, y en la ficha del cliente aparece del 1-nov
  al 15-dic el botón "🔁 Mensaje de renovación 2027" (wa.me) con el texto aprobado. El cron ya
  no llama a Twilio en ningún caso, tampoco en la lógica antigua de 60 días.

## Resultado medible

1. Un lead sin evidencia de firma devuelve 404 `{ "error": "sin_consentimiento" }` en
   `consent-pdf` y `precarta-pdf`, y la ficha muestra "Sin consentimiento firmado" en lugar de
   los botones de PDF.
2. "Abrir en HealthSherpa" abre `https://www.healthsherpa.com/public/shop?...&off_ex=false`
   con los datos puestos, y ninguna URL lleva nombre, teléfono, correo ni fecha de nacimiento.
3. Con planes 2027 y estatus que pierde el subsidio, el CMS recibe `aptc_eligible=false` solo
   para el principal.
4. El 1-nov de 2026 el cron deja el primer recordatorio en las 127 renovaciones, sin un solo
   mensaje de la plataforma al cliente.
5. Borrar un lead con consentimiento devuelve 409 con el texto legal, y no se borra nada.

## Guion ejecutado

| Paso | Verificación | Resultado |
|---|---|---|
| 0. `pwd`, rama desde `main` actualizado | `pwd` = `/Users/simonfranco/enrollsalud`; `git pull --ff-only` | ✅ |
| 0. Paso 0 de solo lectura | Consultas a `pg_constraint`, `renewal_reminders`, `consents`/`leads`, `storage.buckets`; greps | ✅ tabla de arriba |
| 0. Línea base | `tsc` limpio; suite de `main` con `.claude/**` excluido: **36 archivos, 298 pruebas** | ✅ |
| 1. `src/lib/consent-evidence.ts` + consent-pdf, precarta GET (auth + dueño), precarta POST (exige firma), `tiene_consentimiento` en `GET /api/leads/[id]` y en la página | 404 sin evidencia; firma y fecha de la fila de `consents`; legacy válido; nombre nunca como firma | ✅ 6 pruebas nuevas en consent-pdf, 3 en GET, `manual-plan-consent` exige 404 |
| 2. `src/lib/plan-year.ts` (movido de plans) y `src/lib/healthsherpa-link.ts`; los dos componentes lo usan; botón "Enviar enlace al cliente por WhatsApp" (`user_type=consumer`) | 31-oct→2026, 1-nov→2027, 31-dic→2027, 15-ene→2027, override `PLAN_YEAR`; URL solo con 10 parámetros permitidos | ✅ |
| 3. `immigrationStatus` a `/api/plans`, `primaryLosesSubsidy`, `refugee`/`temporary_visa`/`cofa` en rules, menú e i18n; `RULES_VERSION` "2026-10" | 2027+tps: principal sin subsidio, hijo con subsidio; 2026+tps con; citizen con; `hasEmployerCoverage` igual | ✅ |
| 4. `oepLimiteEneroFecha` en aca-stats, `src/lib/renewal-reminder.ts`, cron anclado al 15-dic con "desde", sin Twilio | Reloj fijo: 31-oct nada; 1-nov primero; 2-nov sin duplicar; 3-nov recupera; 1-dic segundo; 10-dic tercero; 16-dic cierra; 16-ene nada; Twilio nunca llamado | ✅ |
| 5. DELETE único, 23503 → 409 | Con consentimiento: 409, un solo DELETE intentado; sin consentimiento: 200; otro FK: 409 sin hablar de consentimiento | ✅ |
| 6. `vitest.config.ts` excluye `.claude/**` | Los worktrees locales en `.claude/worktrees/` (gitignored) resolvían `@/` contra este `src` y fallaban al cambiar `RULES_VERSION` | ✅ |
| 7. revisor-seguridad sobre el diff | Sin hallazgos críticos nuevos; aplicados: guarda de teléfono en EnrollClient y nombre de archivo ASCII en los dos PDF | ✅ |

## Reporte de verificación

| Esperado | Obtenido |
|---|---|
| `npx tsc --noEmit` sin errores | ✅ exit 0 |
| `npm test` en verde | ✅ **40 archivos, 379 pruebas** (antes 36 / 298 → +81) |
| `npm run build` en verde | ✅ exit 0 (solo el aviso conocido de lockfile en `~`) |
| Búsquedas vacías en src: ruta ICHRA `off_ex`, `$?/mes`, "Vi que te interesa el plan", `typed_signature \|\| clientName` | ✅ 0 / 0 / 0 / 0 |
| revisor-seguridad pasado | ✅ ver pendientes |
| Enlace de HealthSherpa en el Preview | ⏳ lo valida Simón: el enlace de prueba con `_agent_id=AGENTE_PRUEBA` está en el PR; para que HealthSherpa lo reconozca hay que poner su `_agent_id` real |

Enlace generado por el helper con datos de prueba:

```
https://www.healthsherpa.com/public/shop?_agent_id=AGENTE_PRUEBA&zip_code=33914&people%5Bprimary%5D%5Bage%5D=40&people%5Bprimary%5D%5Bgender%5D=female&household_income=32000&household_size=3&user_type=agent&skip=true&off_ex=false&external_id=00000000-0000-4000-8000-000000000001
```

### Pendientes y preguntas abiertas

- **`user_type` del consumidor:** confirmado `consumer` en la documentación de HealthSherpa,
  así que se construyó el botón. Falta probarlo de punta a punta con un agente real.
- **`ai_queries`:** 0 filas y sin escritor activo. No se borró nada. Si alguna vez tiene
  filas, el DELETE devolverá 409 ("otros registros guardados"). Opciones para Simón: FK
  `ON DELETE SET NULL` (migración) o retirar la tabla y `/api/ai-log`.
- **Renovaciones que no son 1 de enero:** 0 hoy. Mantienen los avisos exactos a 60/30/15 días,
  ahora solo como notas.
- **284 de 290 leads (cartera importada) no tienen `ages`/`genders`:** para ellos no aparecen
  los botones de HealthSherpa, porque faltan datos obligatorios del enlace.
- **`POST /api/precarta-pdf` sigue sin autenticación** (preexistente; lo llama el cotizador
  público). El bucket `precarta-pdfs` es privado (`public=false`). Falta atarlo al token del
  lead y ponerle rate limit. Va en un PR aparte.
- **Telemetría `aptc-forensics` en `/api/plans`:** vencida desde el 28-abr; conviene retirarla.
- **Twilio:** el cron ya no lo usa, así que la dependencia `twilio` y las variables `TWILIO_*`
  quedan sin uso. La rama `fix/cron-renewals-remove-twilio` (correo resumen al agente y limpieza
  de Privacidad) choca con este cron: hay que rebasarla o cerrarla.
- **Fecha de la fila de `consents`:** `consent_date` es tipo `date`; antes se formateaba con
  zona de Nueva York y mostraba el día anterior. Ahora se muestra en UTC (el día guardado).

## Lección

Un encargo que pide «mandar X al cliente» se cruza contra lo que la plataforma ya prometió
por escrito (Términos, Privacidad) y contra las ramas abiertas del mismo archivo antes de
escribir el envío. Aquí, `git worktree list` mostró una rama del 6-ago que quitaba justo ese
envío por esa razón. Y una suite de pruebas que «pasa» puede estar contando pruebas de otros
worktrees: la línea base se mide con el mismo alcance que el resultado.
