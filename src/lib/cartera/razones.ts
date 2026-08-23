import type { RiskLevel, RiskReason } from "./scoring";

// Traducciones para la UI del panel. Las claves viven en
// portfolio_clients.risk_reasons / risk_level; la base guarda inglés,
// la interfaz habla español.

export const RAZONES_ES: Record<RiskReason, string> = {
  subsidy_dependent:
    "Depende fuertemente del subsidio: el recorte le pega directo al bolsillo",
  subsidy_cliff: "Perdió elegibilidad de subsidio por ingreso (supera 400% del FPL)",
  age_55_plus: "Tiene 55 años o más: primas más altas y acantilado de subsidio más severo",
  bronze_plan: "Compró un plan Bronze por precio: muy sensible a aumentos",
  auto_renewal_shock: "Se renovaba automáticamente: riesgo de shock en la primera factura",
  large_household: "Hogar de varios miembros: el aumento familiar es mayor en dólares",
};

export const NIVELES_ES: Record<RiskLevel, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

export function razonEnEspanol(key: string): string {
  return RAZONES_ES[key as RiskReason] ?? key;
}
