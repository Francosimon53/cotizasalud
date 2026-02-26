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
        consumer_signature: body.consumerSignature,
        consent_date: body.consentDate,
        consent_duration: body.consentDuration || '12_months',
        auth_search_application: body.authSearch || false,
        auth_complete_enrollment: body.authEnrollment || false,
        auth_account_maintenance: body.authMaintenance || false,
        auth_respond_inquiries: body.authInquiries || false,
        eligibility_verified: body.eligibilityVerified || false,
        agent_name: body.agentName || 'CotizaSalud',
        agent_npn: body.agentNpn || null,
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
