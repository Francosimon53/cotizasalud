import { NextRequest, NextResponse } from "next/server";

// TEMPORARY endpoint to verify Sentry captures errors in production.
// Guarded by SENTRY_TEST_TOKEN env var — without a match returns 404.
// Will be deleted in a follow-up PR once a test event appears in Sentry.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.SENTRY_TEST_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  throw new Error(`Sentry sanity check — ${new Date().toISOString()}`);
}
