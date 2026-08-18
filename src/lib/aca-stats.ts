// Narrativa canónica de cifras ACA — cualquier página nueva cita desde aquí.
// Las páginas existentes (/, /cotizar, llms.txt) aún tienen estas cifras inline;
// no migradas a propósito para no tocar copy ya publicado.
//
// Fechas del OEP 2027 — hay DOS fechas distintas y no deben confundirse:
//   · oepLimiteEnero ("15 de diciembre"): último día para seleccionar plan si se
//     quiere cobertura desde el 1 de enero. NO es el fin del período.
//   · oepFinPeriodo ("15 de enero"): cierre real del período en los estados que
//     usan HealthCare.gov, incluida Florida. Quien se inscribe entre el 16 de
//     diciembre y el 15 de enero arranca cobertura el 1 de febrero.
// La regla de CMS que cerraba el OEP el 15 de diciembre fue anulada judicialmente
// en junio de 2026; HHS lo aclaró en agosto de 2026.
//   · diasHastaCoberturaEnero (45): días entre el 1 de noviembre y el 15 de
//     diciembre. Es la ventana para asegurar cobertura desde enero — nunca la
//     duración total del período.
export const ACA_STATS = {
  primaBrutaPct: 26, // aumento promedio de prima bruta 2026
  pagoNetoPct: 58, // aumento promedio del pago neto de bolsillo 2026
  mismoPlanPct: 114, // proyección para quien mantiene el mismo plan
  oepInicio: "1 de noviembre",
  oepLimiteEnero: "15 de diciembre",
  oepFinPeriodo: "15 de enero",
  diasHastaCoberturaEnero: 45,
  fuente: "KFF / CMS 2026",
} as const;
