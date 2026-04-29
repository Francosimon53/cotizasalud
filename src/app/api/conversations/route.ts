import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { normalizeAgentSlugFromRequest } from "@/lib/normalize-slug";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentSlug, planHiosId, planName, messages } = body;
    const normalized = normalizeAgentSlugFromRequest(agentSlug, request);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        agent_slug: normalized.ok ? normalized.slug : null,
        selected_plan_hios_id: planHiosId || null,
        selected_plan_name: planName || null,
        messages: messages || [],
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Conversation create error:", error);
      return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("Conversations API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, messages, status, summary, leadId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (messages) update.messages = messages;
    if (status) update.status = status;
    if (summary) update.conversation_summary = summary;
    if (leadId) update.lead_id = leadId;

    const { error } = await supabase.from("ai_conversations").update(update).eq("id", conversationId);
    if (error) {
      console.error("Conversation update error:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Conversations PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
