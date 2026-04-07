import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase-auth";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
