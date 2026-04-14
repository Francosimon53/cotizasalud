import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { jsPDF } from "jspdf";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric" });
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createServiceClient();

    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single();
    if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const { data: agent } = await supabase.from("agents").select("name, npn, agency_name").eq("slug", lead.agent_slug).single();

    const clientName = lead.contact_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "N/A";
    const agentName = agent?.name || "EnrollSalud Agent";
    const agentNpn = agent?.npn || "N/A";
    const agencyName = agent?.agency_name || "FPI Enterprises, Inc.";
    const consentDate = fmtDate(lead.created_at);
    const expirationDate = fmtDate(addMonths(lead.created_at, 12));
    const address = [lead.street_address, lead.apt_number, lead.city, lead.state_form || lead.state].filter(Boolean).join(", ") || "N/A";

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = W - margin * 2;
    let y = 20;

    // Header
    doc.setFillColor(30, 58, 95); // #1E3A5F
    doc.rect(0, 0, W, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EnrollSalud", margin, 14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Consentimiento del Consumidor / Consumer Consent", margin, 22);
    doc.text("for Agent Services", margin, 27);
    y = 40;

    // Reset text color
    doc.setTextColor(30, 41, 59); // #1E293B

    // Client info section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Datos del Cliente / Client Information", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const clientLines = [
      `Nombre / Name: ${clientName}`,
      `Teléfono / Phone: ${lead.contact_phone || "N/A"}`,
      `Email: ${lead.contact_email || "N/A"}`,
      `Dirección / Address: ${address}`,
      `ZIP: ${lead.zipcode || "N/A"}  —  Condado / County: ${lead.county || "N/A"}, ${lead.state || "FL"}`,
    ];
    for (const line of clientLines) {
      doc.text(line, margin, y);
      y += 5.5;
    }
    y += 4;

    // Agent info section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Datos del Agente / Agent Information", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Agente / Agent: ${agentName}`, margin, y); y += 5.5;
    doc.text(`NPN: ${agentNpn}`, margin, y); y += 5.5;
    doc.text(`Agencia / Agency: ${agencyName}`, margin, y); y += 5.5;
    y += 6;

    // Divider
    doc.setDrawColor(226, 232, 240); // #E2E8F0
    doc.line(margin, y, W - margin, y);
    y += 8;

    // Spanish consent text
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Consentimiento (Español)", margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const esText = `Yo, ${clientName}, autorizo a ${agentName} (NPN: ${agentNpn}) a actuar como mi agente de seguros de salud para asistirme en la búsqueda, comparación e inscripción de un plan de seguro médico a través del Mercado de Seguros (Marketplace). Entiendo que este consentimiento es válido por 12 meses a partir de la fecha de firma.`;
    const esLines = doc.splitTextToSize(esText, contentW);
    doc.text(esLines, margin, y);
    y += esLines.length * 5 + 6;

    // English consent text
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Consent (English)", margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const enText = `I, ${clientName}, authorize ${agentName} (NPN: ${agentNpn}) to act as my health insurance agent to assist me in searching, comparing, and enrolling in a health insurance plan through the Health Insurance Marketplace. I understand this consent is valid for 12 months from the date of signature.`;
    const enLines = doc.splitTextToSize(enText, contentW);
    doc.text(enLines, margin, y);
    y += enLines.length * 5 + 8;

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, W - margin, y);
    y += 8;

    // Dates
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Fecha de consentimiento / Date: ${consentDate}`, margin, y); y += 6;
    doc.text(`Válido hasta / Valid until: ${expirationDate}`, margin, y); y += 10;

    // Signature image or fallback
    if (lead.signature_data && lead.signature_data.startsWith("data:image")) {
      try {
        doc.addImage(lead.signature_data, "PNG", margin, y, 60, 22);
        y += 24;
      } catch {
        // Fallback if image fails
        doc.setFont("helvetica", "italic");
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text(clientName, margin, y + 10);
        y += 16;
      }
    } else {
      // No signature — render name in italic as fallback
      doc.setFont("helvetica", "italic");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(clientName, margin, y + 10);
      y += 16;
    }

    // Signature line
    doc.setDrawColor(30, 41, 59);
    doc.line(margin, y, margin + 80, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${clientName}`, margin, y);
    y += 4;
    doc.text("Firma del consumidor / Consumer signature", margin, y);
    y += 8;

    // Digital signature metadata with IP and timestamp
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // #94A3B8
    const consentTs = lead.consent_timestamp ? new Date(lead.consent_timestamp).toLocaleString("es-US", { dateStyle: "long", timeStyle: "medium" }) : consentDate;
    const consentIp = lead.consent_ip || "N/A";
    doc.text(`Firmado digitalmente desde IP ${consentIp} el ${consentTs}`, margin, y);
    y += 4;
    doc.text(`Digitally signed from IP ${consentIp} on ${consentTs}`, margin, y);

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 4, W - margin, footerY - 4);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // #94A3B8
    doc.text("EnrollSalud es operado por FPI Enterprises, Inc. — www.enrollsalud.com", W / 2, footerY, { align: "center" });
    doc.text("Este documento no constituye una póliza de seguro. / This document does not constitute an insurance policy.", W / 2, footerY + 4, { align: "center" });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Consentimiento_${clientName.replace(/\s+/g, "_")}_${lead.created_at.split("T")[0]}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Consent PDF error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
