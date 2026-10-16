import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { jsPDF } from "jspdf";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { buscarEvidencia, formatearFechaFirma } from "@/lib/consent-evidence";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

function fmtDate(iso: string): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric" });
}

function buildPdf(
  clientName: string,
  clientDob: string,
  agentName: string,
  agentNPN: string,
  agentPhone: string,
  signatureDataUrl: string,
  signedDate: string,
  ip: string,
  typedSignature = "",
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = W - margin * 2;
  let y = 0;

  // Header
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("AUTORIZACIÓN PARA COTIZACIÓN", W / 2, 16, { align: "center" });
  y = 34;

  doc.setTextColor(30, 41, 59);

  // Body text
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const bodyText = `Yo, ${clientName}, estoy solicitando asistencia para recibir una COTIZACIÓN de Seguro de Salud por Medio del Mercado de Seguros Médicos. Certifico que he recibido y entendido la asesoría brindada por:`;
  const bodyLines = doc.splitTextToSize(bodyText, contentW);
  doc.text(bodyLines, margin, y);
  y += bodyLines.length * 4.5 + 6;

  // Agent info box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y - 2, contentW, 20, 3, 3, "FD");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Agente Autorizado: ${agentName || "N/A"}`, margin + 6, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(`NPN: ${agentNPN || "N/A"}`, margin + 6, y + 11);
  doc.text(`Teléfono: ${agentPhone || "N/A"}`, margin + 80, y + 11);
  y += 26;

  // Client info
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, W - margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Datos del Cliente", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${clientName}`, margin, y); y += 5.5;
  doc.text(`Fecha de Nacimiento: ${clientDob ? fmtDate(clientDob) : "N/A"}`, margin, y);
  y += 10;

  // Disclaimer
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, W - margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  const disclaimer = "Al firmar, autorizo al agente mencionado a recopilar mi información personal únicamente para el propósito de generar una cotización de seguro de salud a través del Mercado de Seguros.";
  const discLines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(discLines, margin, y);
  y += discLines.length * 4 + 8;

  // Signature image
  doc.setTextColor(30, 41, 59);
  if (signatureDataUrl && signatureDataUrl.startsWith("data:image")) {
    try {
      doc.addImage(signatureDataUrl, "PNG", margin, y, 60, 22);
      y += 24;
    } catch { /* skip */ }
  }
  if (typedSignature) {
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(typedSignature, margin, y);
    y += 3;
  }

  doc.setDrawColor(30, 41, 59);
  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma del Cliente", margin, y);
  y += 7;

  // Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Fecha de Firma: ${signedDate}`, margin, y);
  y += 6;

  // IP metadata
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    ip ? `Firmado digitalmente desde IP ${ip} el ${signedDate}` : `Firmado digitalmente el ${signedDate}`,
    margin,
    y
  );

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, W - margin, footerY - 4);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("EnrollSalud es operado por FPI Enterprises, Inc. — www.enrollsalud.com", W / 2, footerY, { align: "center" });
  doc.text("Este documento no constituye una póliza de seguro.", W / 2, footerY + 3.5, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

// GET — agent dashboard: generate pre-carta PDF from lead data. Same guard as
// consent-pdf: authenticated agent who owns the lead, and real signature
// evidence (never the client's name as signature nor created_at as date).
export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const callerAgent = auth.agent;

  const leadId = request.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json(
    { error: "leadId required" },
    { status: 400, headers: NO_STORE_HEADERS }
  );

  try {
    const supabase = createServiceClient();
    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
    if (error || !lead) return NextResponse.json(
      { error: "Lead not found" },
      { status: 404, headers: NO_STORE_HEADERS }
    );

    if (lead.agent_id !== callerAgent.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const evidencia = await buscarEvidencia(supabase, lead);
    if (!evidencia) {
      return NextResponse.json(
        { error: "sin_consentimiento" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const { data: agent } = await supabase.from("agents").select("name, npn, phone").eq("slug", lead.agent_slug).single();

    const clientName = lead.contact_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "N/A";
    const signedDate = formatearFechaFirma(evidencia.fecha);

    const pdfBuffer = buildPdf(
      clientName,
      lead.dob || "",
      agent?.name || "EnrollSalud Agent",
      agent?.npn || "N/A",
      agent?.phone || "N/A",
      evidencia.firmaImagen || "",
      signedDate,
      evidencia.ip || "",
      evidencia.firmaTexto || "",
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        // Solo ASCII seguro: un nombre con comillas o fuera de latin1 rompería la cabecera.
        "Content-Disposition": `attachment; filename="PreCarta_${clientName.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "_")}_${String(lead.created_at).split("T")[0]}.pdf"`,
        ...NO_STORE_HEADERS,
      },
    });
  } catch (err) {
    console.error("Pre-carta PDF GET error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

// POST — cotizador, paso de la pre-carta (el cliente todavía no tiene lead,
// así que no hay token que pedir). Genera el PDF firmado y lo guarda en el
// bucket privado precarta-pdfs: ese archivo es el único registro de la firma
// de la pre-carta, así que se sigue guardando. Lo que cambió (2026-10-16):
// - límite de pedidos por IP (10 cada 5 minutos: alcanza para una oficina que
//   cotiza a varios clientes seguidos y corta el abuso);
// - topes de tamaño para no aceptar cuerpos gigantes;
// - ya no devuelve el PDF ni una URL pública (el bucket es privado y el
//   cotizador no usaba ninguna de las dos cosas).
const MAX_FIRMA_CHARS = 500_000; // un PNG de firma real pesa una fracción de esto
const MAX_NOMBRE_CHARS = 120;

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimit(`precarta:${ip}`, { max: 10, windowMs: 300_000 }).limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: NO_STORE_HEADERS });
  }

  try {
    const body = await request.json();
    const { signatureDataUrl, signedAt } = body ?? {};

    const clientName = texto(body?.clientName, MAX_NOMBRE_CHARS + 1);
    if (clientName.length < 2 || clientName.length > MAX_NOMBRE_CHARS) {
      return NextResponse.json({ error: "clientName required" }, { status: 400, headers: NO_STORE_HEADERS });
    }
    const clientDob = texto(body?.clientDob, 10);
    if (clientDob && !/^\d{4}-\d{2}-\d{2}$/.test(clientDob)) {
      return NextResponse.json({ error: "clientDob invalid" }, { status: 400, headers: NO_STORE_HEADERS });
    }
    // Sin firma dibujada no hay pre-carta firmada.
    if (typeof signatureDataUrl !== "string" || !signatureDataUrl.startsWith("data:image")) {
      return NextResponse.json({ error: "sin_firma" }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (signatureDataUrl.length > MAX_FIRMA_CHARS) {
      return NextResponse.json({ error: "firma_demasiado_grande" }, { status: 413, headers: NO_STORE_HEADERS });
    }

    const agentName = texto(body?.agentName, 120);
    const agentNPN = texto(body?.agentNPN, 20);
    const agentPhone = texto(body?.agentPhone, 30);

    const firmado = typeof signedAt === "string" ? new Date(signedAt) : null;
    const fechaFirma = firmado && !Number.isNaN(firmado.getTime()) ? firmado : new Date();
    const signedDate = fechaFirma.toLocaleString("es-US", { dateStyle: "long", timeStyle: "medium", timeZone: "America/New_York" });
    const ipFirma = request.headers.get("x-forwarded-for") || "";

    const pdfBuffer = buildPdf(clientName, clientDob, agentName, agentNPN, agentPhone, signatureDataUrl, signedDate, ipFirma);

    // Guardar en el bucket privado (registro de la firma).
    const supabase = createServiceClient();
    const safeName = clientName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/\s+/g, "_");
    const dateSlug = new Date().toISOString().split("T")[0];
    const fileName = `PreCarta_${safeName}_${dateSlug}_${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("precarta-pdfs")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      console.error("Pre-carta upload error:", uploadError);
      return NextResponse.json({ error: "No se pudo guardar la pre-carta" }, { status: 500, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json({ success: true, fileName }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("Pre-carta PDF POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
