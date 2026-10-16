import { ACA_STATS } from "@/lib/aca-stats";

// Recordatorios de renovaciones del 1 de enero del año Y. El límite para que
// el plan empiece el 1 de enero es el 15 de diciembre de Y-1
// (ACA_STATS.oepLimiteEneroFecha). EnrollSalud no escribe al cliente final
// (Términos de Servicio): el cron deja notas internas y el agente manda el
// mensaje desde su propio WhatsApp con el texto de mensajeRenovacion().

export const PRIMER_RECORDATORIO = { mes: 11, dia: 1 };
export const SEGUNDO_RECORDATORIO = { mes: 12, dia: 1 };
export const TERCER_RECORDATORIO = { mes: 12, dia: 10 };

export type FechaCalendario = { anio: number; mes: number; dia: number };

// Fecha del calendario en Florida (America/New_York), mes 1-12.
export function fechaEnFlorida(now: Date): FechaCalendario {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { anio: n("year"), mes: n("month"), dia: n("day") };
}

const desde = (hoy: FechaCalendario, f: { mes: number; dia: number }) =>
  hoy.mes > f.mes || (hoy.mes === f.mes && hoy.dia >= f.dia);

export type VentanaEnero = {
  // Año Y de la renovación del 1 de enero que se está trabajando.
  anioRenovacion: number;
  // Hoy está entre el 1-nov y el 15-dic de Y-1 (inclusive).
  antesDelLimite: boolean;
  desdeSegundo: boolean;
  desdeTercero: boolean;
  // Días que faltan para el 15-dic (solo en diciembre antes del límite).
  diasAlLimite: number | null;
};

// null fuera de la ventana (16-ene a 31-oct). Del 16-dic al 15-ene la ventana
// sigue abierta pero ya pasó el límite: la cobertura empezaría el 1-feb.
export function ventanaEnero(now: Date): VentanaEnero | null {
  const hoy = fechaEnFlorida(now);
  const limite = ACA_STATS.oepLimiteEneroFecha;
  const anioRenovacion =
    hoy.mes >= PRIMER_RECORDATORIO.mes ? hoy.anio + 1 : hoy.mes === 1 && hoy.dia <= 15 ? hoy.anio : null;
  if (anioRenovacion === null) return null;
  const enNovDic = hoy.mes >= PRIMER_RECORDATORIO.mes;
  const antesDelLimite = enNovDic && !desde(hoy, { mes: limite.mes, dia: limite.dia + 1 });
  return {
    anioRenovacion,
    antesDelLimite,
    desdeSegundo: enNovDic && desde(hoy, SEGUNDO_RECORDATORIO),
    desdeTercero: enNovDic && desde(hoy, TERCER_RECORDATORIO),
    diasAlLimite: antesDelLimite && hoy.mes === limite.mes ? limite.dia - hoy.dia : null,
  };
}

// Texto que el agente manda al cliente desde su propio WhatsApp.
export function mensajeRenovacion(f: {
  nombre: string;
  agente: string;
  telefono: string;
  anio: number;
}): string {
  return `Hola ${f.nombre}, soy ${f.agente}, tu agente de seguro médico. Ya abrió la inscripción para ${f.anio}. Este año HealthSherpa te va a mandar un mensaje o un correo para que me autorices a renovar tu plan: ábrelo tú desde tu teléfono. Si quieres que tu plan empiece el 1 de enero, el límite es el ${ACA_STATS.oepLimiteEnero}. Cualquier duda, llámame al ${f.telefono}.`;
}
