import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";

const ADMIN_SLUGS = ["simon-dev", "delbert"];

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const { data: admin } = await db.from("agents").select("slug").eq("auth_user_id", user.id).single();
  if (!admin || !ADMIN_SLUGS.includes(admin.slug)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { agentId, isActive } = await request.json();
  const { error } = await db.from("agents").update({ is_active: isActive }).eq("id", agentId);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ success: true });
}
