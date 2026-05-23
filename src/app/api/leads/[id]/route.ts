import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent } = auth;

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

    if (lead.agent_id !== agent.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
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

// Coerce a form value to a finite number, or null. Empty string / null /
// undefined / non-numeric all become null so the PDF renders "N/A" rather
// than a bogus 0 (fmtCurrency renders a genuine 0 as "$0").
function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Agent-driven manual plan entry/edit. Writes the selected_plan jsonb with the
// exact keys the consent PDF reads (name, issuer, premium, deductible, oopMax,
// effectiveDate), preserving any pre-existing keys (id/metal/afterSubsidy/...).
// Mirrors the GET/DELETE anti-spoofing pattern: 401/403 from the auth helper,
// 404 if the lead is missing, 403 if it belongs to another agent. Does NOT
// change lead status — that is owned by the enroll flow.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent } = auth;

  const { id } = await params;

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const plan = body.plan && typeof body.plan === "object" ? body.plan : null;
  if (!plan) {
    return NextResponse.json(
      { error: "Missing plan" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const supabase = createServiceClient();

    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("agent_id, selected_plan")
      .eq("id", id)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (lead.agent_id !== agent.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const existing =
      lead.selected_plan && typeof lead.selected_plan === "object" ? lead.selected_plan : {};

    // Merge over existing so id/metal/afterSubsidy/copays survive an edit.
    const merged = {
      ...existing,
      name: toStringOrNull(plan.name),
      issuer: toStringOrNull(plan.issuer),
      premium: toNumberOrNull(plan.premium),
      deductible: toNumberOrNull(plan.deductible),
      oopMax: toNumberOrNull(plan.oopMax),
      effectiveDate: toStringOrNull(plan.effectiveDate),
    };
    if (plan.afterSubsidy !== undefined) {
      merged.afterSubsidy = toNumberOrNull(plan.afterSubsidy);
    }

    const { error } = await supabase
      .from("leads")
      .update({
        selected_plan: merged,
        selected_plan_name: merged.name,
        selected_premium: merged.afterSubsidy ?? merged.premium,
      })
      .eq("id", id);

    if (error) {
      console.error("Update lead plan error:", error);
      return NextResponse.json(
        { error: "Failed to update" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, selected_plan: merged },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("Update lead plan error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent } = auth;

  const { id } = await params;
  try {
    const supabase = createServiceClient();

    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("agent_id")
      .eq("id", id)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (lead.agent_id !== agent.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

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
