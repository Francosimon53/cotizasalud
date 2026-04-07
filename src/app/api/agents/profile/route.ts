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
  const { npn, email, phone, agency_name, brand_name, brand_color, logo_url } = body;

  if (!npn?.trim() || !email?.trim() || !phone?.trim() || !agency_name?.trim()) {
    return NextResponse.json({ error: "NPN, email, teléfono y agencia son requeridos" }, { status: 400 });
  }

  const db = createServiceClient();
  const update: Record<string, string | null> = {
    npn: npn.trim(),
    email: email.trim(),
    phone: phone.trim(),
    agency_name: agency_name.trim(),
  };
  if (brand_color) update.brand_color = brand_color;
  if (logo_url !== undefined) update.logo_url = logo_url || null;
  // brand_name stored in agency_name (that's the existing column)

  const { error } = await db.from("agents").update(update).eq("auth_user_id", user.id);
  if (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
