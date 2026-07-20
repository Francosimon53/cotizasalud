import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { isCarteraEnabled } from "@/lib/feature-flags";
import {
  PORTFOLIO_FIELDS,
  coerceNumber,
  coerceInt,
  coerceBoolean,
  coerceMetal,
  coerceDate,
} from "@/lib/cartera/csv";
import { scorePortfolioClient } from "@/lib/cartera/scoring";
import { dedupeKeyFor, type DedupeTier } from "@/lib/cartera/dedupe";

const MAX_ROWS = 1000;
const MAX_STORED_ERRORS = 50;

// Body: rows already mapped client-side (mapping screen) to
// { field: rawString }. Values arrive as strings; coercion + validation
// happen here — the client preview is advisory only.
const BodySchema = z.object({
  fileName: z.string().trim().max(200).optional(),
  rows: z
    .array(z.partialRecord(z.enum(PORTFOLIO_FIELDS), z.string().max(500)))
    .min(1)
    .max(MAX_ROWS),
});

// Validated shape of one client after coercion. Out-of-range values make the
// row invalid; missing fields are fine (they only lower score_confidence).
const ClientSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  date_of_birth: z.string().nullable(),
  estimated_age: z.number().int().min(0).max(129).nullable(),
  zip_code: z.string().max(10).nullable(),
  county: z.string().max(80).nullable(),
  household_members: z.number().int().min(1).max(20).nullable(),
  estimated_annual_income: z.number().min(0).max(10_000_000).nullable(),
  current_carrier: z.string().max(120).nullable(),
  metal_level: z.enum(["bronze", "silver", "gold", "platinum"]).nullable(),
  monthly_premium: z.number().min(0).max(100_000).nullable(),
  monthly_subsidy: z.number().min(0).max(100_000).nullable(),
  auto_renewal: z.boolean().nullable(),
  phone: z.string().max(30).nullable(),
  email: z.string().max(200).nullable(),
});

type RawRow = Partial<Record<(typeof PORTFOLIO_FIELDS)[number], string>>;

// Coerce raw strings to typed values. Returns the candidate plus the list of
// fields that were present but unparseable — those invalidate the row (the
// agent should fix the mapping) instead of silently dropping data.
function coerceRow(raw: RawRow) {
  const bad: string[] = [];
  const take = <T>(field: keyof RawRow, coerce: (v: string) => T | null): T | null => {
    const v = raw[field];
    if (v == null || v.trim() === "") return null;
    const out = coerce(v);
    if (out == null) bad.push(field);
    return out;
  };
  const candidate = {
    full_name: raw.full_name?.trim() ?? "",
    date_of_birth: take("date_of_birth", coerceDate),
    estimated_age: take("estimated_age", coerceInt),
    zip_code: raw.zip_code?.trim() || null,
    county: raw.county?.trim() || null,
    household_members: take("household_members", coerceInt),
    estimated_annual_income: take("estimated_annual_income", coerceNumber),
    current_carrier: raw.current_carrier?.trim() || null,
    metal_level: take("metal_level", coerceMetal),
    monthly_premium: take("monthly_premium", coerceNumber),
    monthly_subsidy: take("monthly_subsidy", coerceNumber),
    auto_renewal: take("auto_renewal", coerceBoolean),
    phone: raw.phone?.trim() || null,
    email: raw.email?.trim() || null,
  };
  return { candidate, bad };
}

export async function POST(request: NextRequest) {
  if (!isCarteraEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent, user } = auth;

  // Rate limit by authenticated user, not IP — multiple agents may share an IP.
  if (
    rateLimit(`cartera-import:${user.id}`, { max: 10, windowMs: 60 * 60_000 })
      .limited
  ) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    // Zod issues on this schema carry paths/limits, never row contents.
    return NextResponse.json(
      {
        error: `Invalid body. Expected { fileName?, rows: [...] } with 1-${MAX_ROWS} rows.`,
      },
      { status: 400 }
    );
  }

  const { fileName, rows } = parsed.data;
  const referenceDate = new Date();
  const errors: { row: number; reason: string }[] = [];
  // Dedupe within the file: keyed by dedupe_key. For dob/zip tiers the last
  // row wins; name_only collisions are never merged (see partition below).
  const byKey = new Map<string, { client: Record<string, unknown>; tier: DedupeTier }>();
  let possibleDuplicates = 0;
  let validCount = 0;

  rows.forEach((raw, i) => {
    const { candidate, bad } = coerceRow(raw);
    if (bad.length > 0) {
      // Field names only — never values (no PII in errors).
      errors.push({ row: i + 1, reason: `invalid_${bad[0]}` });
      return;
    }
    const valid = ClientSchema.safeParse(candidate);
    if (!valid.success) {
      const firstPath = valid.error.issues[0]?.path?.[0] ?? "row";
      errors.push({ row: i + 1, reason: `invalid_${String(firstPath)}` });
      return;
    }
    const assessment = scorePortfolioClient(
      {
        dateOfBirth: valid.data.date_of_birth,
        estimatedAge: valid.data.estimated_age,
        householdMembers: valid.data.household_members,
        estimatedAnnualIncome: valid.data.estimated_annual_income,
        metalLevel: valid.data.metal_level,
        monthlyPremium: valid.data.monthly_premium,
        monthlySubsidy: valid.data.monthly_subsidy,
        autoRenewal: valid.data.auto_renewal,
      },
      referenceDate
    );
    validCount++;
    const { key, tier } = dedupeKeyFor(valid.data);
    if (tier === "name_only" && byKey.has(key)) {
      // Same bare name twice in one file with nothing to tell them apart:
      // keep the first, report the rest — never merge on name alone.
      possibleDuplicates++;
      return;
    }
    byKey.set(key, {
      tier,
      client: {
        ...valid.data,
        // Ownership always comes from the session — never from the body.
        agent_id: agent.id,
        dedupe_key: key,
        risk_score: assessment.riskScore,
        risk_level: assessment.riskLevel,
        risk_reasons: assessment.riskReasons,
        score_confidence: assessment.scoreConfidence,
        source: "csv",
        updated_at: referenceDate.toISOString(),
      },
    });
  });

  const db = createServiceClient();

  try {
    // Existing keys for this agent decide insert vs update, and let us skip
    // (not merge) name_only collisions before any write happens.
    const { data: existingRows, error: existingError } = await db
      .from("portfolio_clients")
      .select("dedupe_key")
      .eq("agent_id", agent.id);
    if (existingError) {
      console.error(
        "Cartera existing-keys select error:",
        existingError.code,
        existingError.message
      );
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
    const existingKeys = new Set(
      (existingRows ?? []).map((r: { dedupe_key: string }) => r.dedupe_key)
    );

    const toWrite: Record<string, unknown>[] = [];
    let insertedCount = 0;
    let updatedCount = 0;
    for (const { client, tier } of byKey.values()) {
      const exists = existingKeys.has(client.dedupe_key as string);
      if (tier === "name_only" && exists) {
        // A bare-name match against the stored book could be a different
        // person — leave the stored row untouched and flag it for review.
        possibleDuplicates++;
        continue;
      }
      if (exists) updatedCount++;
      else insertedCount++;
      toWrite.push(client);
    }

    const { data: importRow, error: importError } = await db
      .from("portfolio_imports")
      .insert({
        agent_id: agent.id,
        file_name: fileName || null,
        total_rows: rows.length,
        valid_rows: validCount,
        error_rows: errors.length,
        inserted_rows: insertedCount,
        updated_rows: updatedCount,
        possible_duplicates: possibleDuplicates,
        errors: errors.slice(0, MAX_STORED_ERRORS),
      })
      .select("id")
      .single();

    if (importError || !importRow) {
      console.error("Cartera import insert error:", importError?.code, importError?.message);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    if (toWrite.length > 0) {
      const withImportId = toWrite.map((c) => ({ ...c, import_id: importRow.id }));
      // One statement, atomic: matches on (agent_id, dedupe_key) update in
      // place (new data + recalculated score), the rest insert.
      const { error: clientsError } = await db
        .from("portfolio_clients")
        .upsert(withImportId, { onConflict: "agent_id,dedupe_key" });
      if (clientsError) {
        console.error(
          "Cartera clients upsert error:",
          clientsError.code,
          clientsError.message
        );
        // Best-effort rollback so counts never point at missing rows.
        await db.from("portfolio_imports").delete().eq("id", importRow.id);
        return NextResponse.json({ error: "Insert failed" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      importId: importRow.id,
      totalRows: rows.length,
      validRows: validCount,
      errorRows: errors.length,
      insertedRows: insertedCount,
      updatedRows: updatedCount,
      possibleDuplicates,
    });
  } catch (err) {
    // Message only — the error object could echo row payloads.
    console.error("Cartera import API error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
