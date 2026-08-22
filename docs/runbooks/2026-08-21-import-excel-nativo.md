# 2026-08-21 — Importador de clientes: .xlsx nativo en el navegador

Rama `feat/import-excel-nativo` sobre `main` (4c20fc5).

## Resultado medible

Un agente sube el `.xlsx` que le exporta HealthSherpa (o el que arma a mano) y ve la
misma vista previa, el mismo reporte de columnas y el mismo botón "Importar N Clientes"
que con un CSV. El archivo binario nunca viaja al servidor: el navegador lo convierte a
las mismas filas JSON que ya produce el camino CSV y `/api/leads/import` no cambia.
Teléfonos, primas y fechas que Excel guarda como número/fecha llegan como el mismo texto
que habrían llegado desde un CSV.

## Qué cambió

| Archivo | Cambio |
|---|---|
| `package.json`, `package-lock.json` | dependencia `read-excel-file@^9.3.10` |
| `src/lib/leads/import-csv.ts` | se extrae `parseLeadCells(cells: string[][])` — la etapa compartida "matriz de celdas (fila 0 = encabezados) → `ParsedFile`". `parseLeadFile(text)` conserva firma y comportamiento: ahora es `parseCsv(text)` → `parseLeadCells([...])`. Ningún test existente cambió. |
| `src/lib/leads/import-xlsx.ts` (nuevo) | funciones puras `normalizeSheetCell`, `formatSheetNumber`, `formatSheetDate`, `sheetToCells`, `sheetHasContent`: convierten las celdas tipadas de `read-excel-file` a `string[][]`. |
| `src/lib/leads/__tests__/import-xlsx.test.ts` (nuevo) | 15 tests con matrices sintéticas (sin binarios en el repo), incluido el test de paridad CSV ↔ Excel. |
| `src/app/agentes/dashboard/import/ImportClient.tsx` | `handleFile` se divide en `readCsv` / `readXlsx`; `.xlsx` ya no se rechaza; `accept` incluye `.xlsx` y su MIME; import dinámico de `read-excel-file/browser`; límites de 10 MB y 5.000 filas; nota de hoja leída cuando el libro tiene varias con datos; copy del botón y del párrafo de ayuda. |
| `docs/runbooks/2026-08-21-import-excel-nativo.md` | este runbook |

## Guion ejecutado

| # | Acción | Verificación |
|---|---|---|
| 0 | Investigación read-only de `import-csv.ts`, `ImportClient.tsx`, tests, `renewal-date.ts`, `vitest.config.ts` | Parseo y mapeo separables en un punto limpio (`parseCsv` → resto). `parseLeadFile` es pura. Los tests sólo usan `parseLeadFile(texto)`. Baseline: 772 tests / 96 archivos (294 / 34 reales, el resto copias de `.claude/worktrees`). |
| 1 | Extraer `parseLeadCells` | `vitest` de `src/lib/leads` y `src/app/api/leads` en verde sin tocar ningún test. |
| 2 | `import-xlsx.ts` — normalización de celdas | tests: número → sin notación científica; `Date` UTC → `YYYY-MM-DD`; `null` → `""`; booleano → `"true"/"false"`; relleno de filas cortas; recorte de filas en blanco finales. |
| 3 | Camino Excel en `ImportClient.tsx` | `tsc` exit 0; build exit 0; el chunk de ImportClient no contiene la librería (grep `InvalidSpreadsheetError` = 0); la librería vive en un chunk propio referenciado sólo desde ImportClient. |
| 4 | Tests | 787 / 787 (+15). Paridad: mismo libro como CSV y como matriz-Excel → `rows`, `mappedFields`, `missingFields`, `ignoredHeaders`, `droppedRows` idénticos. |
| 5 | Gate | ver abajo. |

## Gate (salida real)

- `npx tsc --noEmit` → exit 0, 0 errores.
- `npx vitest run` → **787 passed (97 archivos)**; baseline en main 772 (96). Vitest sigue corriendo las copias de `.claude/worktrees` (62 archivos de 97): los números reales son **309 tests / 35 archivos** frente a 294 / 34 en main. No se tocó `vitest.config.ts` (fuera del alcance de este PR).
- `npx next build` → exit 0. Next 16 no imprime tamaños por ruta; medido sumando chunks de `.next/static`:
  - chunk de `ImportClient` (identificado por la cadena del botón): **13.993 B → 16.175 B** (+2.182 B: el handler nuevo + el normalizador).
  - `read-excel-file` queda en un chunk aparte de **54.375 B** que sólo referencia el chunk de ImportClient → se descarga únicamente al elegir un `.xlsx`.
  - Total de chunks estáticos: 2.712.472 B (42) → 2.770.897 B (44). Además del chunk de la librería, Turbopack re-partió un chunk de la página `/share` (457.810 → 432.956 + 26.722, +1.868 B); no está relacionado con el importador.

## Por qué `read-excel-file` y no `xlsx` / `exceljs`

- `xlsx` (SheetJS en npm) está congelado en 0.18.5 desde marzo de 2022 y arrastra
  CVE-2023-30533 (prototype pollution al leer archivos — exactamente nuestro caso de uso:
  archivos que sube un tercero). La versión mantenida sólo se distribuye fuera de npm.
- `exceljs` no tiene release estable desde octubre de 2023 y depende de módulos de Node
  (streams, zlib) que no cuadran con "parsear 100 % en el navegador".
- `read-excel-file` es pequeña (≈54 KB en nuestro chunk), tiene entry `/browser` sin
  dependencias de Node, convierte celdas a tipos nativos y devuelve todas las hojas con
  su nombre. Detalle importante que no coincide con snippets viejos: **la v9 no tiene
  export raíz** — el import es `read-excel-file/browser`, y su default export devuelve
  `[{ sheet, data }]` (todas las hojas), no una sola.

## La trampa de zona horaria

`read-excel-file` convierte el serial de Excel a un `Date` en **00:00 UTC** del día de la
celda (`parseExcelDate.js` de la librería). Leerlo con `getFullYear/getMonth/getDate`
(locales) en Florida (UTC-4/-5) devuelve la tarde del día anterior: `2026-01-01` se
convierte en `2025-12-31`, y esa fecha alimenta `nextRenewalDate()` y el recordatorio de
renovación. Por eso `formatSheetDate` usa exclusivamente `getUTCFullYear/getUTCMonth/
getUTCDate`, y hay un test explícito con `new Date("2026-01-01T00:00:00.000Z")` →
`"2026-01-01"`.

## Límites elegidos (protegen el navegador del agente)

- **10 MB por archivo .xlsx** — se rechaza antes de parsear, con el peso real en el mensaje.
  Un .xlsx es un zip que se infla varias veces al leerse.
- **5.000 filas de datos por hoja** — se rechaza con el número real de filas y la
  sugerencia de dividir el archivo. Nunca se trunca en silencio. Las filas en blanco del
  final de la hoja no cuentan (se recortan en `sheetToCells`); las intermedias sí, y se
  reportan como "filas en blanco ignoradas" igual que en CSV.
- Ambos límites aplican sólo al camino Excel; el camino CSV no cambia.

## Decisiones de detalle

- Primera hoja con contenido: no se pide al agente que elija. Si el libro tiene más de
  una hoja con datos, la tarjeta "Columnas detectadas" dice cuál se leyó y cuáles no.
- Errores de lectura (zip corrupto, `.xlsx` protegido con contraseña — que en realidad es
  un contenedor OLE2 cifrado, no un zip — o cualquier excepción de la librería) → un solo
  mensaje en español con la salida: quitar la contraseña o volver a guardar como .xlsx/CSV.
- Al elegir un archivo nuevo se limpia la vista previa anterior (`setReport(null)` al
  inicio de `handleFile`), también para CSV.
- `.xls`, `.numbers`, `.ods` se siguen rechazando, ahora pidiendo .xlsx **o** CSV.

## Qué quedó fuera

- `.xls` binario (Excel 97-2003), `.ods`, `.numbers`: la librería no los lee.
- Encabezados que no estén en la primera fila (libros con título o filas de resumen arriba).
- Códigos postales con cero inicial guardados como número en Excel (Excel ya perdió el
  cero antes de llegar aquí; no aplica a Florida).
- Excluir `.claude/worktrees` de vitest (inflación del conteo reportada arriba).
