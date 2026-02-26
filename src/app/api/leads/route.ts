import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    // Save lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        agent_slug: body.agentSlug || null,
        zipcode: body.zipcode,
        county: body.county,
        state: body.state || 'FL',
        household_size: body.householdSize,
        annual_income: body.annualIncome,
        fpl_percentage: body.fplPercentage,
        aptc_estimate: body.aptcEstimate || 0,
        ages: body.ages,
        uses_tobacco: body.usesTobacco || false,
        language: body.language || 'es',
        contact_name: body.contactName,
        contact_phone: body.contactPhone,
        contact_email: body.contactEmail || null,
        status: 'new',
      })
      .select()
      .single()

    if (leadError) {
      console.error('Lead insert error:', leadError)
      return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
    }

    // Track page view
    await supabase.from('page_views').insert({
      agent_slug: body.agentSlug || null,
      page: '/cotizar',
      referrer: body.referrer || null,
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
    })

    return NextResponse.json({ success: true, leadId: lead.id })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
