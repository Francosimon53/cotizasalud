import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const { data: agent } = await db
    .from("agents")
    .select("slug, name, email, phone, npn, agency_name, brand_color, logo_url")
    .eq("auth_user_id", user.id)
    .single();

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { npn, email, phone, agency_name, brand_color, logo_url, full_name, slug, licensed_states, appointed_carriers, preferred_language, photo_url, onboarding_complete } = body;

  if (!npn?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "NPN y teléfono son requeridos" }, { status: 400 });
  }

  const db = createServiceClient();
  const update: Record<string, unknown> = {
    npn: npn.trim(),
    phone: phone.trim(),
  };
  if (email?.trim()) update.email = email.trim();
  if (agency_name?.trim()) update.agency_name = agency_name.trim();
  if (full_name?.trim()) update.name = full_name.trim();
  if (brand_color) update.brand_color = brand_color;
  if (logo_url !== undefined) update.logo_url = logo_url || null;
  if (photo_url !== undefined) update.photo_url = photo_url || null;
  if (licensed_states) update.licensed_states = licensed_states;
  if (appointed_carriers) update.appointed_carriers = appointed_carriers;
  if (preferred_language) update.preferred_language = preferred_language;
  if (onboarding_complete !== undefined) update.onboarding_complete = onboarding_complete;
  if (slug?.trim()) {
    // Verify slug uniqueness
    const { data: slugOwner } = await db.from("agents").select("auth_user_id").eq("slug", slug.trim()).single();
    if (!slugOwner || slugOwner.auth_user_id === user.id) {
      update.slug = slug.trim();
    }
  }

  const { error } = await db.from("agents").update(update).eq("auth_user_id", user.id);

  // Send admin notification for new agent registrations. Inlined from the
  // former /api/admin/notify-agent route (deleted) so the Resend send is not
  // exposed as a public-callable endpoint.
  if (onboarding_complete && full_name) {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const name = full_name.trim();
      const npnTrim = npn.trim();
      const emailTrim = email?.trim() || user.email;
      const phoneTrim = phone.trim();
      (async () => {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(apiKey);
          await resend.emails.send({
            from: "EnrollSalud <notifications@enrollsalud.com>",
            to: "francosimon@hotmail.com",
            subject: `🆕 Nuevo agente registrado: ${name} — NPN: ${npnTrim}`,
            html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #8b5cf6; padding: 16px 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: #fff; margin: 0; font-size: 18px;">Nuevo Agente Registrado</h2>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
            <table style="width: 100%; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Nombre</td><td style="padding: 6px 0; font-weight: 700;">${name}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">NPN</td><td style="padding: 6px 0; font-weight: 700;">${npnTrim}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;">${emailTrim || "—"}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Teléfono</td><td style="padding: 6px 0;">${phoneTrim}</td></tr>
            </table>
          </div>
        </div>
      `,
          });
        } catch (err) {
          console.error("Admin notify (inlined) error:", err);
        }
      })();
    }
  }
  if (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
