import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { jsPDF } from "jspdf";

function fmtDate(iso: string): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric" });
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null || n === 0) return "N/A";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createServiceClient();

    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single();
    if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const { data: agent } = await supabase.from("agents").select("name, npn, agency_name, phone").eq("slug", lead.agent_slug).single();

    const { data: consent } = await supabase
      .from("consents")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const clientName = lead.contact_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "N/A";
    const agentName = agent?.name || "EnrollSalud Agent";
    const agentNpn = agent?.npn || "N/A";
    const agentPhone = agent?.phone || consent?.agent_phone || "N/A";

    // Plan data: consent record > lead.selected_plan JSON > lead columns
    const sp = lead.selected_plan || {};
    const planName = consent?.plan_name || lead.selected_plan_name || sp.name || "N/A";
    const premium = fmtCurrency(consent?.plan_premium ?? sp.afterSubsidy ?? sp.premium ?? lead.selected_premium);
    const deductible = fmtCurrency(consent?.plan_deductible ?? sp.deductible);
    const maxOop = fmtCurrency(consent?.plan_max_oop ?? sp.oopMax);
    const incomeDisplay = fmtCurrency(lead.annual_income);
    const effectiveDate = consent?.effective_date ? fmtDate(consent.effective_date) : "N/A";

    const clientDob = lead.dob ? fmtDate(lead.dob) : "N/A";
    const clientPhone = lead.contact_phone || "N/A";
    const clientEmail = lead.contact_email || "N/A";

    const typedSig = consent?.typed_signature || clientName;
    const consentTs = consent?.consent_date
      ? new Date(consent.consent_date).toLocaleString("es-US", { dateStyle: "long", timeStyle: "medium", timeZone: "America/New_York" })
      : lead.consent_timestamp
        ? new Date(lead.consent_timestamp).toLocaleString("es-US", { dateStyle: "long", timeStyle: "medium", timeZone: "America/New_York" })
        : fmtDate(lead.created_at);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentW = W - margin * 2;
    const footerH = 20; // reserved for footer
    const maxY = H - footerH;
    let y = 0;

    // Helper: check if we need a page break, add one if so
    const ensureSpace = (needed: number) => {
      if (y + needed > maxY) {
        addFooter();
        doc.addPage();
        y = 20;
      }
    };

    const addFooter = () => {
      const fy = H - 15;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, fy - 4, W - margin, fy - 4);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("EnrollSalud es operado por FPI Enterprises, Inc. — www.enrollsalud.com", W / 2, fy, { align: "center" });
      doc.text("Este documento no constituye una póliza de seguro.", W / 2, fy + 3.5, { align: "center" });
    };

    // ===== PAGE CONTENT =====

    // Header bar
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, W, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CARTA DE CONSENTIMIENTO", W / 2, 16, { align: "center" });
    y = 32;

    doc.setTextColor(30, 41, 59);

    // Main body text
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const bodyText = `Yo, ${clientName}, estoy solicitando asistencia para enrolarme en un Seguro de Salud por Medio del Mercado de Seguros Médicos. He brindado la información necesaria para ser elegible al crédito fiscal que otorga el Mercado de Seguros Médicos y así obtener beneficios de una prima reducida. Certifico que he recibido y entendido la asesoría brindada por:`;
    const bodyLines = doc.splitTextToSize(bodyText, contentW);
    doc.text(bodyLines, margin, y);
    y += bodyLines.length * 4 + 3;

    // Agent info line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const agentLine = `Agente Autorizado: ${agentName}     NPN: ${agentNpn}     Teléfono: ${agentPhone}`;
    const agentLines = doc.splitTextToSize(agentLine, contentW);
    doc.text(agentLines, margin, y);
    y += agentLines.length * 4 + 4;

    // Authorization text
    doc.setFont("helvetica", "normal");
    const authText = `Por este medio doy permiso a ${agentName} para actuar como mi Agente, de Seguro de Salud de mi familia. Al dar mi consentimiento a este acuerdo, autorizo a utilizar la información confidencial proporcionada por escrito, electrónicamente o por teléfono, solo para los fines de uno o más de los siguientes propósitos:`;
    const authLines = doc.splitTextToSize(authText, contentW);
    ensureSpace(authLines.length * 4 + 4);
    doc.text(authLines, margin, y);
    y += authLines.length * 4 + 3;

    // Numbered purposes
    const purposes = [
      "1. Búsqueda y/o creación de una aplicación en el Mercado de Seguros.",
      "2. Completar una solicitud de elegibilidad e inscripción en un Plan de Salud del Mercado u otros programas gubernamentales de asequibilidad de seguros o créditos fiscales anticipados para ayudar a pagar las primas del Mercado.",
      "3. Brindar mantenimiento continuo de la cuenta y asistencia para la inscripción según sea necesario.",
      "4. Responder a consultas del Mercado con respecto a mi solicitud.",
    ];
    for (const purpose of purposes) {
      const pLines = doc.splitTextToSize(purpose, contentW - 6);
      ensureSpace(pLines.length * 4 + 2);
      doc.text(pLines, margin + 4, y);
      y += pLines.length * 4 + 1.5;
    }
    y += 3;

    // Divider
    ensureSpace(10);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, W - margin, y);
    y += 5;

    // Plan Details section
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Detalles del Plan", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const planDataLines = [
      `Nombre del Plan: ${planName}`,
      `Prima Mensual: ${premium}`,
      `Deducible: ${deductible}`,
      `Gasto máximo de bolsillo: ${maxOop}`,
      `Ingreso Total: ${incomeDisplay}`,
      `Fecha de Vigencia: ${effectiveDate}`,
    ];
    for (const line of planDataLines) {
      ensureSpace(5);
      doc.text(`• ${line}`, margin + 4, y);
      y += 5;
    }
    y += 3;

    // Divider
    ensureSpace(10);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, W - margin, y);
    y += 5;

    // Ongoing consent text
    const ongoingText = `Entiendo que mi consentimiento permanece vigente hasta que sea revocado o modificado poniéndome en contacto con el agente arriba mencionado y que mi información personal no será divulgada y será guardada de forma segura. Así mismo entiendo que en casos de cambios tales como:`;
    const ongoingLines = doc.splitTextToSize(ongoingText, contentW);
    ensureSpace(ongoingLines.length * 4 + 35);
    doc.text(ongoingLines, margin, y);
    y += ongoingLines.length * 4 + 3;

    // Changes list
    const changes = [
      "Estatus Marital.",
      "Cambios de Ingresos.",
      "Cambios en el número de personas en mi declaración de Impuestos.",
      "Cambios en el número de personas que necesitan cobertura médica en mi aplicación.",
      "Cambios de estatus migratorio.",
      "Cambios de dirección.",
    ];
    for (const ch of changes) {
      ensureSpace(5);
      doc.text(`• ${ch}`, margin + 4, y);
      y += 4.5;
    }
    y += 2;

    // Closing text
    const closingText = "Debo notificar a mi representante inmediatamente si ocurren estos cambios y sean actualizados en el Sistema. De la misma manera confirmo no tener otro seguro médico.";
    const closingLines = doc.splitTextToSize(closingText, contentW);
    ensureSpace(closingLines.length * 4 + 6);
    doc.text(closingLines, margin, y);
    y += closingLines.length * 4 + 5;

    // Divider
    ensureSpace(10);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, W - margin, y);
    y += 5;

    // Client info footer
    ensureSpace(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Fecha de Nacimiento: ${clientDob}`, margin, y); y += 5;
    doc.text(`Teléfono: ${clientPhone}`, margin, y); y += 5;
    doc.text(`Email: ${clientEmail}`, margin, y); y += 8;

    // Divider
    ensureSpace(10);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, W - margin, y);
    y += 5;

    // Signature disclaimer
    ensureSpace(40);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const sigDisclaimer = "Al firmar digitalmente escribiendo su nombre en este espacio, usted representa legalmente su firma real y reconoce que la información proporcionada es precisa y válida.";
    const sigDisLines = doc.splitTextToSize(sigDisclaimer, contentW);
    doc.text(sigDisLines, margin, y);
    y += sigDisLines.length * 3.5 + 4;

    // Signature image if available
    doc.setTextColor(30, 41, 59);
    if (lead.signature_data && lead.signature_data.startsWith("data:image")) {
      try {
        doc.addImage(lead.signature_data, "PNG", margin, y, 55, 18);
        y += 20;
      } catch {
        // fallback to typed sig below
      }
    }

    // Typed signature
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(14);
    doc.text(typedSig, margin, y);
    y += 3;
    doc.setDrawColor(30, 41, 59);
    doc.line(margin, y, margin + 75, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Firma del Cliente", margin, y);
    y += 5;

    // Date
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`Fecha de Firma: ${consentTs}`, margin, y);
    y += 5;

    // Digital metadata
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    const consentIp = consent?.ip_address || lead.consent_ip || "N/A";
    doc.text(`Firmado digitalmente desde IP ${consentIp} el ${consentTs}`, margin, y);

    // Add footer to current (last) page
    addFooter();

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
