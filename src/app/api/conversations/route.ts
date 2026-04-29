import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { normalizeAgentSlug } from "@/lib/normalize-slug";
import { captureInvalidAgentSlug } from "@/lib/slug-logging";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentSlug, planHiosId, planName, messages } = body;
    const slugResult = normalizeAgentSlug(agentSlug);
    captureInvalidAgentSlug(slugResult, "app/api/conversations/route.ts", {
      url: request.url,
      referer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    });
    const slug = slugResult.ok
      ? slugResult.slug
      : (process.env.DEFAULT_AGENT_SLUG?.trim() || "delbert");

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        agent_slug: slug,
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
