import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent } = auth;

  try {
    const { leadId, note, nextFollowupDate } = await request.json();

    if (!leadId || typeof leadId !== "string" || !UUID_RE.test(leadId)) {
      return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
    }
    if (!note?.trim() && !nextFollowupDate) {
      return NextResponse.json({ error: "Note or followup date required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the lead for ownership verification.
    const { data: lead, error: fetchErr } = await supabase
      .from("leads")
      .select("agent_id")
      .eq("id", leadId)
      .single();

    if (fetchErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (lead.agent_id !== agent.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
