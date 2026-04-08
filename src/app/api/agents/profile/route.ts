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

  // Send notification for new agent registrations
  if (onboarding_complete && full_name) {
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    fetch(`${origin}/api/admin/notify-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: full_name.trim(), npn: npn.trim(), email: email?.trim() || user.email, phone: phone.trim() }),
    }).catch(() => {});
  }
  if (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
