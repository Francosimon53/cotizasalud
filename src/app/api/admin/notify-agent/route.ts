import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ sent: false });

  try {
    const { name, npn, email, phone } = await request.json();
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: "EnrollSalud <notifications@enrollsalud.com>",
      to: "francosimon@hotmail.com",
      subject: `🆕 Nuevo agente registrado: ${name} — NPN: ${npn}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #8b5cf6; padding: 16px 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: #fff; margin: 0; font-size: 18px;">Nuevo Agente Registrado</h2>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
            <table style="width: 100%; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Nombre</td><td style="padding: 6px 0; font-weight: 700;">${name}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">NPN</td><td style="padding: 6px 0; font-weight: 700;">${npn}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;">${email || "—"}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Teléfono</td><td style="padding: 6px 0;">${phone}</td></tr>
            </table>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Admin notify error:", err);
    return NextResponse.json({ sent: false }, { status: 500 });
  }
}
