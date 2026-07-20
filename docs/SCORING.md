# Scoring de riesgo de renovación — Módulo OEP 2027 (Fases A/B)

Motor de reglas transparente (no ML) que estima el riesgo de que un cliente de
la cartera del agente se pierda en la renovación de noviembre 2026.
Implementación: `src/lib/cartera/scoring.ts` (función pura `scorePortfolioClient`).
Este documento y el código deben mantenerse en sincronía.

## Contexto de mercado

Los subsidios ampliados del ACA (ARPA/IRA) expiraron al cierre de 2025. Eso
reactivó el **acantilado de subsidio en 400% del FPL** (por encima no hay APTC)
y subió la prima neta de casi toda la cartera. El cliente que se renueva
automáticamente descubre el aumento en su primera factura de enero — y cancela.
El score ordena la cartera para que el agente re-cotice proactivamente a los de
mayor riesgo antes del OEP.

## Fórmula (calibración Fase B)

`score = suma de señales` — nivel: `critical ≥ 70`, `high 40–69`,
`medium 20–39`, `low < 20` (umbrales sin cambios desde la Fase A).

| Señal | Peso | Regla | Racional |
|---|---|---|---|
| Dependencia de subsidio | 0–30 (lineal) | `subsidio / (prima + subsidio)` × 30; se marca la razón si el ratio ≥ 0.5 | A mayor porción de la prima cubierta por APTC, mayor el shock cuando el subsidio se recorta. Requiere prima y subsidio presentes. |
| Acantilado 400% FPL | +25 | `ingreso_anual > 400% del FPL` para su tamaño de hogar (hogar ausente ⇒ 1) | Sin los subsidios ampliados, sobre 400% FPL la elegibilidad de APTC es **cero**. Es la pérdida más violenta. |
| Edad 55–59 | +10 | 55 ≤ edad < 60 (de `date_of_birth` a la fecha de referencia, o `estimated_age`) | Primas por edad más altas ⇒ el mismo recorte porcentual son más dólares. |
| Edad 60+ | +15 | edad ≥ 60 | Curva de edad aún más empinada en los años previos a Medicare; el acantilado es más severo. |
| Renovación automática | +15 | `auto_renewal = true` | Riesgo de shock en la primera factura: nadie le mostró el aumento antes. |
| Plan Bronze | +8 | `metal_level = bronze` | Compró por precio; es el primero en irse cuando el precio sube. |
| Hogar de 3–4 miembros | +4 | `3 ≤ household_members ≤ 4` | El aumento familiar es mayor en dólares absolutos. |
| Hogar de 5+ miembros | +7 | `household_members ≥ 5` | Más miembros ⇒ el aumento en dólares compone todavía más. |

**Suma máxima teórica: exactamente 100** (30 + 25 + 15 + 15 + 8 + 7). Cada
señal escalonada usa un solo peso (edad usa 10 **o** 15; hogar usa 4 **o** 7).

### Por qué se recalibró (Fase B)

Con los pesos de la Fase A la suma máxima era 105 recortada con `min(100, …)`:
sobre el CSV sintético de 100 clientes, **21 topaban en score 100** y el
ranking de críticos era plano — el agente no sabía a quién llamar primero.
La recalibración baja el techo a 100 exacto y escalona edad y hogar, de modo
que solo el peor perfil absoluto alcanza 100 y los críticos se ordenan entre
sí. Las señales y su dirección no cambiaron; solo la calibración.

Distribución sobre el mismo CSV tras la recalibración: máximo 98, top-10
`98, 97, 97, 95, 95, 94, 94, 94, 93, 92`; niveles 28 critical / 18 high /
25 medium / 29 low (antes: 29/24/18/29). Los cuatro grupos siguen poblados con
los umbrales originales, por eso no se ajustaron.

### Ejemplos de perfiles

| Perfil | Cálculo | Score | Nivel |
|---|---|---|---|
| El peor absoluto: prima $0 + subsidio $800 (ratio 1.0), ingreso sobre 400% FPL, 62 años, auto-renovación, Bronze, hogar de 5 | 30 + 25 + 15 + 15 + 8 + 7 | **100** | Crítico |
| Crítico "de manual": ratio 0.75, sobre el acantilado, 57 años, auto-renovación, Bronze, hogar de 4 | 23 + 25 + 10 + 15 + 8 + 4 | **85** | Crítico |
| Riesgo alto sin señales de edad/hogar: ratio 0.6, sobre el acantilado, 52 años, auto-renovación, Silver, hogar de 2 | 18 + 25 + 0 + 15 + 0 + 0 | **58** | Alto |
| Dependiente joven: ratio 0.8, bajo el acantilado, 34 años, sin auto-renovación, Bronze, hogar de 3 | 24 + 0 + 0 + 0 + 8 + 4 | **36** | Medio |
| Sin señales de riesgo: ratio 0.1, bajo el acantilado, 41 años, Gold, hogar de 1 | 3 | **3** | Bajo |

**Señales ausentes no suman ni restan**: un cliente sin datos de ingreso no
recibe el peso del acantilado (no se asume pérdida de elegibilidad). La
incertidumbre se expresa aparte, en `score_confidence`.

## Confianza (`score_confidence`)

Porcentaje de las 7 señales presentes en el CSV: edad (fecha de nacimiento **o**
edad, cuenta una vez), miembros del hogar, ingreso, nivel de metal, prima,
subsidio y renovación automática. `round(presentes / 7 × 100)`.

## Tabla FPL

Guidelines 2026 del HHS (publicadas en el Federal Register el 15-ene-2026),
48 estados contiguos + D.C. — las vigentes para elegibilidad del plan year 2027:

- 1 persona: **$15,960**
- Cada miembro adicional: **+$5,680** (hogar de 4 = $33,000)

Constantes en `src/lib/cartera/fpl.ts`. Fuente: [ASPE — Poverty Guidelines](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines) /
[Federal Register 2026-00755](https://www.federalregister.gov/documents/2026/01/15/2026-00755/annual-update-of-the-hhs-poverty-guidelines).
Actualizar cuando salgan las guidelines 2027 (enero 2027) si el módulo sigue vivo.

## Claves de razón → texto de UI

Las claves viven en `portfolio_clients.risk_reasons` (jsonb, inglés); la UI las
traduce en `src/lib/cartera/razones.ts`:

| Clave | Texto en la UI |
|---|---|
| `subsidy_dependent` | Depende fuertemente del subsidio: el recorte le pega directo al bolsillo |
| `subsidy_cliff` | Perdió elegibilidad de subsidio por ingreso (supera 400% del FPL) |
| `age_55_plus` | Tiene 55 años o más: primas más altas y acantilado de subsidio más severo |
| `bronze_plan` | Compró un plan Bronze por precio: muy sensible a aumentos |
| `auto_renewal_shock` | Se renovaba automáticamente: riesgo de shock en la primera factura |
| `large_household` | Hogar de varios miembros: el aumento familiar es mayor en dólares |

`risk_level` también se guarda en inglés (`critical/high/medium/low`) y se
traduce en la UI (`Crítico/Alto/Medio/Bajo`).

## Mapeo de columnas del CSV (encabezados aceptados)

El import acepta encabezados en español e inglés (normalizados: minúsculas, sin
acentos). Alias completos en `src/lib/cartera/csv.ts` (`HEADER_ALIASES`).
Etiqueta en la pantalla de mapeo ↔ columna de la base:

| Etiqueta (UI) | Columna | Alias de ejemplo |
|---|---|---|
| Nombre completo | `full_name` | nombre, name, cliente |
| Fecha de nacimiento | `date_of_birth` | dob, fecha_nacimiento |
| Edad | `estimated_age` | edad, age |
| Código postal | `zip_code` | zip, codigo postal |
| Condado | `county` | condado, county |
| Miembros del hogar | `household_members` | miembros hogar, household size |
| Ingreso anual estimado | `estimated_annual_income` | ingreso, income, magi |
| Aseguradora actual | `current_carrier` | aseguradora, carrier |
| Nivel de metal | `metal_level` | metal, metal level (acepta Bronce/Oro/Plata/Platino) |
| Prima mensual | `monthly_premium` | prima, premium |
| Subsidio mensual | `monthly_subsidy` | subsidio, aptc, tax credit |
| Renovación automática | `auto_renewal` | renovacion automatica, auto renew (Sí/No/Yes/No) |
| Teléfono | `phone` | telefono, phone |
| Email | `email` | correo, email |

## Casos borde documentados

- **Cliente solo con nombre y prima**: score 0, nivel `low`, confianza ~14%.
  No se inventa riesgo sin señales.
- **Subsidio 0 con prima presente**: ratio 0 ⇒ sin puntos de dependencia.
- **Ingreso alto con hogar grande**: el umbral de 400% FPL escala con el hogar
  ($63,840 para 1 persona vs $177,440 para 6 en 2026).
- **Fecha de nacimiento inválida**: se ignora (ni suma ni rompe el import).
