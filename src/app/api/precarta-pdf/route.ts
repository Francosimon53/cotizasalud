import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { jsPDF } from "jspdf";

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
  doc.text(`Firmado digitalmente desde IP ${ip} el ${signedDate}`, margin, y);

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

// GET — agent dashboard: generate pre-carta PDF from lead data
export async function GET(request: NextRequest) {
  const leadId = request.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
    if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const { data: agent } = await supabase.from("agents").select("name, npn, phone").eq("slug", lead.agent_slug).single();

    const clientName = lead.contact_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "N/A";
    const signedDate = lead.consent_timestamp
      ? new Date(lead.consent_timestamp).toLocaleString("es-US", { dateStyle: "long", timeStyle: "medium", timeZone: "America/New_York" })
      : fmtDate(lead.created_at);

    const pdfBuffer = buildPdf(
      clientName,
      lead.dob || "",
      agent?.name || "EnrollSalud Agent",
      agent?.npn || "N/A",
      agent?.phone || "N/A",
      lead.signature_data || "",
      signedDate,
      lead.consent_ip || "N/A",
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="PreCarta_${clientName.replace(/\s+/g, "_")}_${lead.created_at.split("T")[0]}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Pre-carta PDF GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — client-side: generate + upload pre-carta PDF
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientName, clientDob, agentName, agentNPN, agentPhone, signatureDataUrl, signedAt } = body;

    if (!clientName) return NextResponse.json({ error: "clientName required" }, { status: 400 });

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

    return NextResponse.json({ success: true, pdfBase64, storageUrl: publicUrl, fileName });
  } catch (err) {
    console.error("Pre-carta PDF POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
