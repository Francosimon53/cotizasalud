import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createServiceClient();

    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { data: activity } = await supabase
      .from("lead_activity")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ lead, activity: activity || [] });
  } catch (err) {
    console.error("Lead detail error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
