import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { normalizePhone } from "@/lib/leads/import-csv";
import {
  coerceDate,
  coercePremium,
  mapStatus,
  nextRenewalDate,
} from "@/lib/leads/renewal-date";

// One request carries the whole file.
//
// This endpoint used to accept a single client per request, so the browser
// fired one HTTP call per CSV row. Against a rate limit of 10 calls per hour
// that made any real book of business impossible to upload: an agent with 200
// clients sent 200 requests, ~10-20 landed and the rest came back 429. It also
// made the limiter's in-memory, per-lambda-instance counter observable as
// flakiness — how many rows survived depended on how many instances Vercel
// happened to spin up.
//
// Batching fixes both: 10 requests per hour now means 10 imports per hour, and
// a single request cannot be split across instances.
//
// The single-client body shape is still accepted so anything else calling this
// endpoint keeps working.

const MAX_ROWS = 1000;
const INSERT_CHUNK = 500;

interface IncomingRow {
  name?: string;
  phone?: string;
  email?: string;
  planName?: string;
  premium?: string | number;
  effectiveDate?: string;
  status?: string;
  zipcode?: string;
  line?: number;
}

type RowOutcome =
  | { kind: "ok"; payload: Record<string, unknown> }
  | { kind: "skipped"; line: number; reason: "duplicate" | "duplicate_in_file" }
  | { kind: "error"; line: number; reason: "missing_name" | "missing_phone" | "invalid_phone" };

export async function POST(request: NextRequest) {
  // Auth: derive identity from the session cookie via the canonical helper.
  // The body's agent_slug, if present, is intentionally ignored — accepting
  // it would let any authenticated agent inject leads under another agent's
  // identity.
  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent, user } = auth;

  // Rate limit by authenticated user, not IP — multiple agents may share an IP.
  if (
    rateLimit(`import:${user.id}`, { max: 10, windowMs: 60 * 60_000 }).limited
  ) {
    return NextResponse.json(
      {
        error: "Too many requests",
        message:
          "Alcanzaste el límite de 10 importaciones por hora. Espera un momento y vuelve a intentar.",
      },
      { status: 429 }
    );
  }

  const db = createServiceClient();

  try {
    const body = await request.json();

    // Batch when the body carries a `rows` array; otherwise treat the body
    // itself as one client (legacy shape).
    const isBatch = Array.isArray(body?.rows);
    const incoming: IncomingRow[] = isBatch ? body.rows : [body];

    if (incoming.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }
    if (incoming.length > MAX_ROWS) {
      return NextResponse.json(
        {
          error: "Too many rows",
          message: `El archivo trae ${incoming.length} filas y el máximo por importación es ${MAX_ROWS}. Divídelo en varios archivos.`,
        },
        { status: 413 }
      );
    }

    // One query for every phone this agent already has, instead of one
    // SELECT per row.
    const { data: existingRows, error: existingError } = await db
      .from("leads")
      .select("contact_phone")
      .eq("agent_slug", agent.slug);

    if (existingError) {
      console.error("Import dedupe query error:", existingError);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    const knownPhones = new Set(
      (existingRows ?? []).map((r: { contact_phone: string | null }) =>
        normalizePhone(r.contact_phone ?? "")
      )
    );

    const now = new Date();
    const seenInFile = new Set<string>();
    const outcomes: RowOutcome[] = [];
    let missingEffectiveDate = 0;

    incoming.forEach((row, i) => {
      const line = typeof row?.line === "number" ? row.line : i + 2;
      const name = String(row?.name ?? "").trim();
      const phone = normalizePhone(String(row?.phone ?? ""));

      if (!name) return void outcomes.push({ kind: "error", line, reason: "missing_name" });
      if (!phone) return void outcomes.push({ kind: "error", line, reason: "missing_phone" });
      if (phone.length < 10) {
        return void outcomes.push({ kind: "error", line, reason: "invalid_phone" });
      }
      if (knownPhones.has(phone)) {
        return void outcomes.push({ kind: "skipped", line, reason: "duplicate" });
      }
      if (seenInFile.has(phone)) {
        return void outcomes.push({ kind: "skipped", line, reason: "duplicate_in_file" });
      }
      seenInFile.add(phone);

      const enrollDate = coerceDate(row?.effectiveDate);
      if (!enrollDate) missingEffectiveDate++;
      const renewDate = nextRenewalDate(enrollDate, now);
      const leadStatus = mapStatus(row?.status);

      outcomes.push({
        kind: "ok",
        payload: {
          agent_id: agent.id,
          agent_slug: agent.slug,
          contact_name: name,
          contact_phone: phone,
          contact_email: String(row?.email ?? "").trim() || null,
          selected_plan_name: String(row?.planName ?? "").trim() || null,
          selected_premium: coercePremium(
            row?.premium == null ? null : String(row.premium)
          ),
          enrollment_date: enrollDate,
          renewal_date: renewDate,
          status: leadStatus,
          enrolled_at: leadStatus === "enrolled" ? now.toISOString() : null,
          first_name: name.split(" ")[0] || name,
          last_name: name.split(" ").slice(1).join(" ") || "",
          zipcode: String(row?.zipcode ?? "").trim(),
          county: "",
          state: "FL",
          household_size: 1,
          annual_income: 0,
          fpl_percentage: 0,
        },
      });
    });

    const toInsert = outcomes.filter(
      (o): o is Extract<RowOutcome, { kind: "ok" }> => o.kind === "ok"
    );

    const insertedIds: string[] = [];
    const insertedRenewals: { lead_id: string; renewal_date: string }[] = [];
    let insertErrors = 0;

    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK);
      const { data, error } = await db
        .from("leads")
        .insert(chunk.map((o) => o.payload))
        .select("id, renewal_date");

      if (error || !data) {
        console.error("Import error:", error);
        insertErrors += chunk.length;
        continue;
      }

      for (const lead of data as { id: string; renewal_date: string | null }[]) {
        insertedIds.push(lead.id);
        if (lead.renewal_date) {
          insertedRenewals.push({ lead_id: lead.id, renewal_date: lead.renewal_date });
        }
      }
    }

    if (insertedRenewals.length > 0) {
      for (let i = 0; i < insertedRenewals.length; i += INSERT_CHUNK) {
        const { error } = await db
          .from("renewal_reminders")
          .insert(insertedRenewals.slice(i, i + INSERT_CHUNK));
        // A failed reminder must not fail the import: the clients are in.
        if (error) console.error("Renewal reminder insert error:", error);
      }
    }

    const imported = insertedIds.length;
    const skipped = outcomes.filter((o) => o.kind === "skipped").length;
    const rowErrors = outcomes.filter((o) => o.kind === "error").length + insertErrors;

    // Legacy single-client shape: keep the original response so any existing
    // caller keeps working.
    if (!isBatch) {
      const only = outcomes[0];
      if (only?.kind === "skipped") {
        return NextResponse.json({ skipped: true, reason: "duplicate" });
      }
      if (only?.kind === "error") {
        return NextResponse.json(
          { error: "Name and phone required" },
          { status: 400 }
        );
      }
      if (imported === 0) {
        return NextResponse.json({ error: "Insert failed" }, { status: 500 });
      }
      return NextResponse.json({ success: true, leadId: insertedIds[0] });
    }

    return NextResponse.json({
      success: true,
      total: incoming.length,
      imported,
      skipped,
      errors: rowErrors,
      missingEffectiveDate,
      // Line numbers and reason codes only — never the client's values.
      details: outcomes
        .filter((o) => o.kind !== "ok")
        .slice(0, 50)
        .map((o) => ({
          line: (o as { line: number }).line,
          reason: (o as { reason: string }).reason,
        })),
    });
  } catch (err) {
    console.error("Import API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
