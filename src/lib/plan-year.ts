// Año del plan que se cotiza o inscribe. Durante el OEP (desde el 1 de
// noviembre) se compran planes del AÑO SIGUIENTE, así que noviembre y
// diciembre devuelven año + 1. La variable PLAN_YEAR (cuatro dígitos) lo
// fuerza manualmente para pruebas o emergencias.
//
// Se calcula con la fecha del calendario de Florida (America/New_York) para
// que la medianoche del 1 de noviembre no dependa de la zona del servidor.
export function derivePlanYear(now: Date = new Date()): number {
  const envOverride = process.env.PLAN_YEAR;
  if (envOverride && /^\d{4}$/.test(envOverride)) {
    return Number(envOverride);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value); // 1-12
  if (month >= 11) return year + 1; // Nov/Dic → planes del año siguiente
  return year;
}
