import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { leadId, note, nextFollowupDate } = await request.json();

    if (!leadId || (!note?.trim() && !nextFollowupDate)) {
      return NextResponse.json({ error: "Lead ID and note or followup date required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (note?.trim()) {
      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        action: "note_added",
        note: note.trim(),
      });
    }

    if (nextFollowupDate) {
      await supabase.from("leads").update({ next_followup_date: nextFollowupDate }).eq("id", leadId);
      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        action: "followup_set",
        note: `Seguimiento programado: ${nextFollowupDate}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Note error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
