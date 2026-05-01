import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

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
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const { data: activity } = await supabase
      .from("lead_activity")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json(
      { lead, activity: activity || [] },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("Lead detail error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createServiceClient();
    await supabase.from("lead_activity").delete().eq("lead_id", id);
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) {
      console.error("Delete lead error:", error);
      return NextResponse.json(
        { error: "Failed to delete" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("Delete lead error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
