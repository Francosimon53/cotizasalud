# Runbook — Módulo OEP 2027, Fase B: dedupe + calibración de scoring + copy

**Fecha:** 2026-07-20 · **Branch:** `feature/modulo-oep-cartera` · **PR #61 sigue en draft**

## Resultado medible (definido antes de empezar)

En el deploy Preview:

- Importar el mismo CSV dos veces deja **100 clientes, no 200**; la segunda
  importación actualiza (y recalcula el puntaje), no duplica.
- Los críticos ya no topan todos en 100: hay dispersión visible que da un
  orden real de a quién llamar primero.
- El subtítulo de Mi Cartera está 100% en español (sin "book of business").
- Suite completa de tests + build limpios.

## Paso 1 — Dedupe del import

**Clave natural** (`src/lib/cartera/dedupe.ts`, columna
`portfolio_clients.dedupe_key`, índice único `(agent_id, dedupe_key)`):

- Nombre normalizado (minúsculas, sin acentos, espacios colapsados) + el campo
  secundario más fuerte disponible:
  - `<nombre>|d:<YYYY-MM-DD>` — con fecha de nacimiento (nivel más confiable)
  - `<nombre>|z:<zip>` — sin DOB pero con código postal
  - `<nombre>|n:` — solo nombre (sin DOB ni ZIP)
- Al importar: si la clave ya existe en la cartera del agente → **upsert**
  (datos nuevos + puntaje recalculado + `updated_at`); si no → insert. La
  respuesta y el historial reportan `insertedRows` / `updatedRows`.
- Duplicado dentro del mismo archivo (misma clave `d:`/`z:`): gana la última fila.

**Comportamiento con colisiones solo-por-nombre (decisión de diseño, pedida
por Simón en la revisión del plan):** dos personas distintas pueden llamarse
igual, y fusionarlas en silencio es el peor error posible del módulo. Por eso
una fila del nivel `|n:` que colisiona — contra la base o contra otra fila del
mismo archivo — **NUNCA se fusiona automáticamente**: se omite (la fila ya
almacenada queda intacta), se cuenta en `possibleDuplicates` y la UI muestra
"N posibles duplicados por nombre — revísalos". El agente decide agregando DOB
o ZIP al CSV y reimportando. Limitación documentada: un cliente importado
primero con DOB y reimportado sin DOB no se reconoce como el mismo (claves de
niveles distintos no se cruzan) — preferimos ese falso negativo a una fusión
incorrecta.

**Migración** `supabase/migrations/20260720190000_portfolio_dedupe.sql`:
columna + backfill SQL con la misma normalización (`unaccent`), limpieza de
duplicados heredados de la Fase A (quedaba la fila más reciente; la base
remota estaba en 0 filas al aplicar, así que no borró nada real), índice
único y contadores nuevos en `portfolio_imports`.

*Verificación:* test de integración con store en memoria que respeta el índice
único — importa `scripts/cartera-sintetica.csv` dos veces vía `POST
/api/cartera/import`: primera → 100 insertados; segunda → **100 filas totales
(no 200), 0 nuevos / 100 actualizados**. Tests adicionales: homónimos en el
mismo archivo y contra la base → `possibleDuplicates` sin escritura;
re-import con prima nueva → puntaje recalculado. ✅

## Paso 2 — Calibración del scoring

Problema medido antes de tocar código (CSV sintético de 100): **21 clientes
clavados en score 100** (suma máxima 105 recortada con `min(100,·)`), ranking
de críticos plano.

Cambio: techo exacto de 100 (30 dependencia + 25 acantilado + 15 edad + 15
auto-renovación + 8 bronze + 7 hogar) y señales escalonadas para romper
empates — edad 55–59 → +10 / 60+ → +15; hogar 3–4 → +4 / 5+ → +7; bronze
10 → 8. Mismas señales, misma dirección. Umbrales de nivel sin cambios
(critical ≥ 70, high 40–69, medium 20–39, low < 20): los cuatro grupos siguen
poblados.

Distribución sobre el mismo CSV (antes → después):

| Métrica | Antes | Después |
|---|---|---|
| Clientes en score 100 | 21 | 0 |
| Top-10 de scores | 100 ×10 | 98, 97, 97, 95, 95, 94, 94, 94, 93, 92 |
| Niveles (crit/alto/medio/bajo) | 29/24/18/29 | 28/18/25/29 |
| Scores distintos entre críticos | 9 | 15 |

*Verificación:* tests unitarios de dispersión (dos críticos "de manual" → 100
vs 85, escalones de edad y hogar) + test permanente sobre el CSV sintético
(nadie en 100, ≥10 scores distintos entre críticos). Detalle y ejemplos de
perfiles en `docs/SCORING.md`. ✅

## Paso 3 — Copy 100% en español

- Subtítulo: "Tu cartera de clientes ordenada por riesgo de perderse en la
  renovación de noviembre 2026".
- Estado vacío: "Importa tu cartera de clientes…".
- Metales en la tabla: Bronce / Plata / Oro / Platino.
- "score" → "puntaje" en todo texto visible (encabezado de columna, ayuda del
  import). Esquema y código siguen en inglés (`risk_score` etc.).
- "import(s)" → "importación/importaciones" (historial, botones, errores).
- Resultado del import: "X clientes nuevos · Y actualizados" + aviso ámbar de
  posibles duplicados por nombre cuando aplica.

*Verificación:* grep de inglés visible en `src/app/agentes/dashboard/cartera/`
sin resultados de cara al usuario; captura de la vista en el PR. ✅ (captura
pendiente de la migración remota, ver estado final)

## Paso 4 — Suite, build y PR

- `npx vitest run` → **303 tests, 37 archivos, todos verdes** (la Fase A cerró
  en 289; los 14 nuevos cubren dedupe, dispersión y analítica ampliada).
- `npx tsc --noEmit` y `npm run build` limpios.
- Analítica: `cartera_importada` ahora incluye `filas_nuevas`,
  `filas_actualizadas`, `posibles_duplicados` — solo conteos numéricos, el
  guard anti-PII (`analytics-cartera.test.ts`) sigue en verde.

## Estado de la migración remota

La aplicación vía Supabase MCP fue bloqueada por el clasificador de permisos
de la sesión (DDL remoto). La migración quedó lista en
`supabase/migrations/20260720190000_portfolio_dedupe.sql` y verificada contra
una base con 0 filas en ambas tablas. **Debe aplicarse al remoto antes de
probar el Preview** (el código de la Fase B lee `dedupe_key` y los contadores
nuevos). Tras aplicarla: E2E en Preview (doble import → 100, no 200) y
capturas para el PR.
