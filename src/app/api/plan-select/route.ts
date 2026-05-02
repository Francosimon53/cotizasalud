import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LEAD_RECENCY_MS = 10 * 60 * 1000
const ELIGIBLE_PRIOR_STATUSES = ['browsing', 'quoted'] as const

// Public endpoint: anonymous cotizar marks the plan they're viewing on the
// lead they just created. Same defense layers as /api/leads/[id]/contact-upgrade
// — rate limit, UUID, lead existence + recency, status whitelist, atomic
// UPDATE WHERE status IN (...).
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimit(`plan-select:${ip}`, { max: 5, windowMs: 60_000 }).limited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const leadId = typeof body.leadId === 'string' ? body.leadId : null
  if (!leadId || !UUID_RE.test(leadId)) {
    return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
  }

  const plan = body.plan && typeof body.plan === 'object' ? body.plan : null
  if (!plan) {
    return NextResponse.json({ error: 'Missing plan' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, created_at, status')
    .eq('id', leadId)
    .single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
  }

  const createdAtMs = new Date(lead.created_at).getTime()
  if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > LEAD_RECENCY_MS) {
    return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
  }

  if (!ELIGIBLE_PRIOR_STATUSES.includes(lead.status)) {
    return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
  }

  const { data: updatedRows, error } = await supabase
    .from('leads')
    .update({
      selected_plan: plan,
      selected_plan_name: plan.name || null,
      selected_premium: plan.afterSubsidy ?? plan.premium ?? null,
      status: 'quoted',
    })
    .eq('id', leadId)
    .in('status', ELIGIBLE_PRIOR_STATUSES as unknown as string[])
    .select('id')

  if (error) {
    console.error('Plan select error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
