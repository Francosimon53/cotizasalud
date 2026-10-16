import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { jsPDF } from "jspdf";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { buscarEvidencia, formatearFechaFirma } from "@/lib/consent-evidence";

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

// POST — client-side: generate + upload pre-carta PDF
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientName, clientDob, agentName, agentNPN, agentPhone, signatureDataUrl, signedAt } = body;

    if (!clientName) return NextResponse.json(
      { error: "clientName required" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
    // Sin firma dibujada no hay pre-carta firmada.
    if (typeof signatureDataUrl !== "string" || !signatureDataUrl.startsWith("data:image")) {
      return NextResponse.json(
        { error: "sin_firma" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const signedDate = signedAt
      ? new Date(signedAt).toLocaleString("es-US", { dateStyle: "long", timeStyle: "medium", timeZone: "America/New_York" })
      : new Date().toLocaleString("es-US", { dateStyle: "long", timeStyle: "medium", timeZone: "America/New_York" });
    const ip = request.headers.get("x-forwarded-for") || "N/A";

    const pdfBuffer = buildPdf(clientName, clientDob || "", agentName || "", agentNPN || "", agentPhone || "", signatureDataUrl || "", signedDate, ip);

    // Upload to Supabase storage
    const supabase = createServiceClient();
    const safeName = clientName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/\s+/g, "_");
    const dateSlug = new Date().toISOString().split("T")[0];
    const fileName = `PreCarta_${safeName}_${dateSlug}_${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("precarta-pdfs")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: false });

    let publicUrl = "";
    if (!uploadError && uploadData?.path) {
      const { data: urlData } = supabase.storage.from("precarta-pdfs").getPublicUrl(uploadData.path);
      publicUrl = urlData?.publicUrl || "";
    } else if (uploadError) {
      console.error("Pre-carta upload error:", uploadError);
    }

    const pdfBase64 = pdfBuffer.toString("base64");

    return NextResponse.json(
      { success: true, pdfBase64, storageUrl: publicUrl, fileName },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("Pre-carta PDF POST error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
