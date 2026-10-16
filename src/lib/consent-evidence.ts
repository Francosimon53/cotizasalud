// Evidencia de firma real del cliente. Los PDF de consentimiento y pre-carta
// solo se generan cuando existe; nunca se usa el nombre del cliente como firma
// ni leads.created_at como fecha de firma.
//
// Cuenta como evidencia:
//   (a) una fila en consents con typed_signature o consumer_signature no vacía;
//   (b) en leads, signature_data no vacío y consent_timestamp no vacío (legacy).

type ServiceClient = { from: (table: string) => any };

export type EvidenciaConsentimiento = {
  fuente: "consents" | "legacy";
  // Texto de la firma escrita, si la hay.
  firmaTexto: string | null;
  // data:image de la firma dibujada, si la hay.
  firmaImagen: string | null;
  // Valor crudo de la fecha de firma (consents.consent_date o leads.consent_timestamp).
  fecha: string;
  ip: string | null;
  // Fila de consents usada (solo con fuente "consents").
  consent: Record<string, any> | null;
};

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function separarFirma(valor: string): { firmaTexto: string | null; firmaImagen: string | null } {
  if (!valor) return { firmaTexto: null, firmaImagen: null };
  return valor.startsWith("data:image")
    ? { firmaTexto: null, firmaImagen: valor }
    : { firmaTexto: valor, firmaImagen: null };
}

export function evaluarEvidencia(
  consent: Record<string, any> | null | undefined,
  lead: Record<string, any>,
): EvidenciaConsentimiento | null {
  if (consent) {
    const typed = texto(consent.typed_signature);
    const consumer = texto(consent.consumer_signature);
    if (typed || consumer) {
      const dibujada = separarFirma(consumer);
      return {
        fuente: "consents",
        firmaTexto: typed || dibujada.firmaTexto,
        firmaImagen: dibujada.firmaImagen,
        fecha: texto(consent.consent_date) || texto(consent.created_at),
        ip: texto(consent.ip_address) || texto(lead.consent_ip) || null,
        consent,
      };
    }
  }

  const sig = texto(lead.signature_data);
  const ts = texto(lead.consent_timestamp);
  if (sig && ts) {
    return {
      fuente: "legacy",
      ...separarFirma(sig),
      fecha: ts,
      ip: texto(lead.consent_ip) || null,
      consent: null,
    };
  }

  return null;
}

// Última fila de consents del lead; null si no hay.
export async function ultimoConsentimiento(
  supabase: ServiceClient,
  leadId: string,
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from("consents")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

export async function buscarEvidencia(
  supabase: ServiceClient,
  lead: Record<string, any>,
): Promise<EvidenciaConsentimiento | null> {
  const consent = await ultimoConsentimiento(supabase, lead.id);
  return evaluarEvidencia(consent, lead);
}

// Formatea la fecha de firma. Un valor solo-fecha (YYYY-MM-DD, como
// consents.consent_date) se muestra en UTC para no correrse un día.
export function formatearFechaFirma(valor: string): string {
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return d.toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleString("es-US", { dateStyle: "long", timeStyle: "medium", timeZone: "America/New_York" });
}
