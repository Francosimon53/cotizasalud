import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { getPriceId, PAID_PLANS, BILLING_INTERVALS } from "@/lib/subscription-plans";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

const BodySchema = z.object({
  plan: z.enum(PAID_PLANS as readonly [string, ...string[]]),
  interval: z.enum(BILLING_INTERVALS as readonly [string, ...string[]]),
});

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

    const rawBody = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid body. Expected { plan: 'basic'|'pro'|'advanced', interval: 'month'|'year' }",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    const { plan, interval } = parsed.data as {
      plan: (typeof PAID_PLANS)[number];
      interval: (typeof BILLING_INTERVALS)[number];
    };

    const priceId = getPriceId(plan, interval);

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
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/agentes/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/agentes/dashboard?checkout=cancelled`,
      metadata: { agent_id: agent.id, plan, interval },
      subscription_data: {
        metadata: { agent_id: agent.id, plan, interval },
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
