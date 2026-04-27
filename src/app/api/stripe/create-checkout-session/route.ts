import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { STRIPE_PRICE_IDS, PAID_PLANS, type PaidPlan } from "@/lib/stripe-config";

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

    const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
    const plan = body?.plan;
    if (typeof plan !== "string" || !(PAID_PLANS as readonly string[]).includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be one of: basic, pro, advanced" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    const paidPlan = plan as PaidPlan;

    const db = createServiceClient();

    const { data: agent, error: agentError } = await db
      .from("agents")
      .select("id, email, stripe_customer_id")
      .eq("auth_user_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    let customerId: string | null = agent.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: agent.email ?? user.email ?? undefined,
        metadata: { agent_id: agent.id },
      });
      customerId = customer.id;

      const { error: updateError } = await db
        .from("agents")
        .update({ stripe_customer_id: customerId })
        .eq("id", agent.id);

      if (updateError) {
        console.error("Failed to persist stripe_customer_id:", updateError);
      }
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: STRIPE_PRICE_IDS[paidPlan], quantity: 1 }],
      success_url: `${origin}/agentes/dashboard?checkout=success`,
      cancel_url: `${origin}/agentes/dashboard?checkout=cancelled`,
      metadata: { agent_id: agent.id, plan: paidPlan },
      subscription_data: {
        metadata: { agent_id: agent.id, plan: paidPlan },
      },
    });

    return NextResponse.json(
      { url: session.url },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
