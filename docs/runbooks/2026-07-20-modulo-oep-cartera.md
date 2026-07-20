# Runbook — Módulo OEP 2027, Fase A: Mi Cartera + scoring de riesgo

**Fecha:** 2026-07-20 · **Branch:** `feature/modulo-oep-cartera` · **PR abierto sin merge**

## Resultado medible (definido antes de empezar)

En el Preview del PR: un agente autenticado sube un CSV de 100 clientes
sintéticos y en <60 s ve su cartera ordenada por score 0–100 con razones en
español; cero PII de clientes en PostHog, logs o errores; suite completa de
tests y build limpios.

## Guion ejecutado (acción → verificación → resultado)

1. **Migración** `portfolio_clients` + `portfolio_imports` (RLS deny-by-default,
   índices por `agent_id`, aplicada al remoto vía Supabase MCP y registrada en
   `supabase/migrations/20260720120000_portfolio_oep_phase_a.sql`).
   *Verificación:* query a `pg_class`/`pg_policies` → ambas tablas con
   `rls_enabled=true` y 1 policy deny. ✅
2. **Motor de scoring** (`src/lib/cartera/scoring.ts` + `fpl.ts` + `razones.ts`),
   función pura con FPL 2026 verificado contra ASPE/Federal Register.
   *Verificación:* 22 tests unitarios (casos borde: sin ingreso, subsidio 0,
   hogar 1 vs 6, solo nombre+prima, cap 100, umbrales). ✅
3. **Parser CSV + mapeo ES/EN** (`src/lib/cartera/csv.ts`).
   *Verificación:* 11 tests (RFC-4180 con comillas/comas/BOM, encabezados
   mixtos español/inglés, coerciones). ✅
4. **Endpoint** `POST /api/cartera/import` + `GET /api/cartera` tras
   `requireAuthenticatedAgent` + rate limit por user + flag.
   *Verificación:* 11 tests de integración — 401/404/429, conteos de filas
   válidas/inválidas en `portfolio_imports`, anti-IDOR de escritura (agent_id
   siempre de la sesión) y de lectura (queries scoped al agente), rollback. ✅
5. **Vista "Mi Cartera"** + flujo de import con pantalla de mapeo + botón en el
   header, todo tras `NEXT_PUBLIC_FEATURE_CARTERA=1`.
   *Verificación E2E local:* registro de agente sintético → import de
   `scripts/cartera-sintetica.csv` → **100/100 importados**, resumen
   28 críticos / 25 altos / 18 medios / 29 bajos, tabla ordenada por score,
   razones en español al expandir. Capturas en el PR. ✅
6. **Analítica sin PII:** `cartera_importada` y `cartera_vista` en
   `src/lib/analytics.ts`.
   *Verificación:* en dev con key de prueba, los eventos salen por `/srx/e/`
   (200) y el debug de posthog-js confirma `send "cartera_vista"`; test
   permanente `analytics-cartera.test.ts` afirma payloads 100% numéricos y
   no-op sin key; `ph-no-capture` verificado en el DOM envolviendo la tabla
   (session replay nunca graba datos de clientes). Fila inválida del CSV de
   prueba rechazada con razón `invalid_monthly_premium` (sin valores). ✅
7. **Datos sintéticos:** `scripts/cartera-sintetica.csv` (100 clientes, tel 555,
   emails @example.com). *Verificación:* test `cartera-sintetica.test.ts`
   importa el archivo real y exige los 4 niveles presentes. ✅
8. **Suite y build.** *Verificación:* `npm test` completo y `npm run build`
   limpios en el branch rebasado sobre main (post-merge de PR #60). ✅
   Nota: la cifra "137 tests" del brief estaba desactualizada; el conteo real
   pre-módulo era 239 casos (worktrees de otros branches excluidos de vitest
   en este PR — fallaban por mezcla de versiones, no por código real).
9. **Limpieza:** el agente E2E (`cartera-e2e` / cartera.e2e@example.com) y sus
   filas de cartera se eliminaron de la base tras la prueba. ✅

## Cómo reproducir en el Preview

1. `NEXT_PUBLIC_FEATURE_CARTERA=1` debe estar en el env Preview de Vercel
   (verificar contra el bundle desplegado, no confiar en "Added").
2. Login con tu cuenta de agente → botón **Mi Cartera** en el header.
3. Importar CSV → `scripts/cartera-sintetica.csv` → revisar mapeo → confirmar.
4. Esperado: 100/100 importados, 4 niveles con badges, razones en español,
   historial de imports con el archivo.

## Rollback

Feature flag off (`NEXT_PUBLIC_FEATURE_CARTERA` ausente) desactiva ruta, API y
botón. Las tablas son aditivas; para revertir del todo:
`DROP TABLE portfolio_clients; DROP TABLE portfolio_imports;`
