import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerAuthClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = createServiceClient();

    // Check if agent record already exists
    const { data: existing } = await db
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ success: true, message: "Agent already exists" });
    }

    // Generate slug from email
    const slug = user.email?.split("@")[0]?.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || `agent-${Date.now()}`;

    // Check slug uniqueness, append random suffix if needed
    const { data: slugExists } = await db.from("agents").select("id").eq("slug", slug).single();
    const finalSlug = slugExists ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

    const { error } = await db.from("agents").insert({
      auth_user_id: user.id,
      name: user.email?.split("@")[0] || "Nuevo Agente",
      slug: finalSlug,
      email: user.email,
      is_active: true,
      subscription_plan: "trial",
      subscription_status: "active",
    });

    if (error) {
      console.error("Agent creation error:", error);
      return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
