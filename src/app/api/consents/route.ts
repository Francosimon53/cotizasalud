import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('consents')
      .insert({
        lead_id: body.leadId || null,
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
