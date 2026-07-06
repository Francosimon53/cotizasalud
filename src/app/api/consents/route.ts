import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyLeadToken } from '@/lib/lead-token'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Defense in depth behind the capability token (see contact-upgrade).
const LEAD_TOKEN_MAX_AGE_MS = 72 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimit(`consents:${ip}`, { max: 3, windowMs: 300_000 }).limited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const supabase = createServiceClient()

    // leadId is optional in this contract (a consent can stand alone), but
    // when present the caller must hold the lead's capability token — same
    // check and same vague 400 as plan-select / contact-upgrade, so a consent
    // can't be attached to someone else's lead.
    const leadId = typeof body.leadId === 'string' && body.leadId ? body.leadId : null
    if (leadId) {
      if (!UUID_RE.test(leadId)) {
        return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
      }
      const { data: lead, error: leadErr } = await supabase
        .from('leads')
        .select('id, created_at, client_token_hash')
        .eq('id', leadId)
        .single()
      if (leadErr || !lead) {
        return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
      }
      if (!verifyLeadToken(request.headers.get('x-lead-token'), lead.client_token_hash)) {
        return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
      }
      const createdAtMs = new Date(lead.created_at).getTime()
      if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > LEAD_TOKEN_MAX_AGE_MS) {
        return NextResponse.json({ error: 'Invalid lead reference' }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('consents')
      .insert({
        lead_id: leadId,
        consumer_name: body.consumerName,
        consumer_phone: body.consumerPhone || null,
        consumer_email: body.consumerEmail || null,
        consumer_dob: body.consumerDob || null,
        consumer_income: body.consumerIncome || null,
        typed_signature: body.typedSignature || null,
        consent_date: body.consentDate,
        agent_name: body.agentName || 'EnrollSalud',
        agent_npn: body.agentNpn || null,
        agent_phone: body.agentPhone || null,
        plan_name: body.planName || null,
        plan_premium: body.planPremium || null,
        plan_deductible: body.planDeductible || null,
        plan_max_oop: body.planMaxOop || null,
        effective_date: body.effectiveDate || null,
        ip_address: request.headers.get('x-forwarded-for') || null,
        user_agent: request.headers.get('user-agent') || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Consent insert error:', error)
      return NextResponse.json({ error: 'Failed to save consent' }, { status: 500 })
    }

    return NextResponse.json({ success: true, consentId: data.id })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
