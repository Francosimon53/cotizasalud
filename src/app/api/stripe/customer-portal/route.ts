import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerAuthClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const db = createServiceClient();

    const { data: agent, error: agentError } = await db
      .from("agents")
      .select("id, stripe_customer_id")
      .eq("auth_user_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (!agent.stripe_customer_id) {
      return NextResponse.json(
        { error: "No active billing customer for this agent" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: agent.stripe_customer_id,
      return_url: `${origin}/agentes/dashboard`,
    });

    return NextResponse.json(
      { url: session.url },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("Stripe customer portal error:", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
