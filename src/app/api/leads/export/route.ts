import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Header names match the aliases ImportClient's parser recognizes so an
// exported file re-imports cleanly (round trip: export → edit → import).
// created_at / utm_* / zipcode are extra context the importer ignores.
const CSV_HEADERS = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "plan_name",
  "premium",
  "effective_date",
  "status",
  "zipcode",
  "created_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

// RFC 4180: quote any field containing comma, double quote, or newline;
// double up embedded quotes.
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface ExportRow {
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  selected_plan_name: string | null;
  selected_premium: number | null;
  enrollment_date: string | null;
  status: string | null;
  zipcode: string | null;
  created_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

export async function GET() {
  // Identity comes from the session cookie only — never from query or body.
  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent, user } = auth;

  if (
    rateLimit(`export:${user.id}`, { max: 30, windowMs: 60 * 60_000 }).limited
  ) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("leads")
    .select(
      "first_name, last_name, contact_name, contact_phone, contact_email, selected_plan_name, selected_premium, enrollment_date, status, zipcode, created_at, utm_source, utm_medium, utm_campaign"
    )
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  const leads = (data ?? []) as ExportRow[];

  const rows = leads.map((lead) => {
    // Older rows (quoter flow) only have contact_name; split it the same way
    // the importer does so first/last survive the round trip.
    const nameParts = (lead.contact_name ?? "").trim().split(/\s+/);
    const firstName = lead.first_name || nameParts[0] || "";
    const lastName = lead.last_name || nameParts.slice(1).join(" ") || "";
    return [
      firstName,
      lastName,
      lead.contact_phone,
      lead.contact_email,
      lead.selected_plan_name,
      lead.selected_premium,
      lead.enrollment_date,
      lead.status,
      lead.zipcode,
      lead.created_at,
      lead.utm_source,
      lead.utm_medium,
      lead.utm_campaign,
    ]
      .map(csvField)
      .join(",");
  });

  // BOM so Excel decodes UTF-8 (accents, ñ) instead of mangling it.
  const csv =
    "\uFEFF" + [CSV_HEADERS.join(","), ...rows].join("\r\n") + "\r\n";

  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-enrollsalud-${date}.csv"`,
      // Row count for the client (analytics) without re-parsing the CSV.
      "X-Total-Count": String(rows.length),
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}
