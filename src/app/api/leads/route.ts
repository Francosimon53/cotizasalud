import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const VALID_STATUSES = ['browsing', 'new', 'contacted', 'quoted', 'enrolled', 'lost']
const LOST_REASONS = ['too_expensive', 'another_plan', 'got_medicaid', 'no_response', 'other']
const STATUS_TIMESTAMP: Record<string, string> = {
  contacted: 'contacted_at',
  quoted: 'quoted_at',
  enrolled: 'enrolled_at',
  lost: 'lost_at',
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, status, note, lostReason, nextFollowupDate, contactName, contactPhone, contactEmail, firstName, lastName } = body

    if (!leadId || !status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid leadId or status' }, { status: 400 })
    }
    // Note required for agent-side status changes, not for browsing→new upgrade
    const isContactUpgrade = (status === 'new' && contactName && contactPhone)
    if (!isContactUpgrade && (!note || !note.trim())) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 })
    }
    if (status === 'lost' && (!lostReason || !LOST_REASONS.includes(lostReason))) {
      return NextResponse.json({ error: 'Lost reason is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get current status for activity log
    const { data: current } = await supabase.from('leads').select('status').eq('id', leadId).single()
    const fromStatus = current?.status || 'unknown'

    // Build update payload
    const update: Record<string, unknown> = { status }
    const tsCol = STATUS_TIMESTAMP[status]
    if (tsCol) update[tsCol] = new Date().toISOString()
    if (status === 'lost') update.lost_reason = lostReason
    if (nextFollowupDate) update.next_followup_date = nextFollowupDate
    if (contactName) update.contact_name = contactName
    if (contactPhone) update.contact_phone = contactPhone
    if (contactEmail) update.contact_email = contactEmail
    if (firstName) update.first_name = firstName
    if (lastName) update.last_name = lastName

    const { error } = await supabase.from('leads').update(update).eq('id', leadId)
    if (error) {
      console.error('Lead update error:', error)
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
    }

    // Log activity
    await supabase.from('lead_activity').insert({
      lead_id: leadId,
      action: 'status_change',
      from_status: fromStatus,
      to_status: status,
      note: (note?.trim()) || (isContactUpgrade ? `Contacto: ${contactName} — ${contactPhone}` : ""),
      lost_reason: status === 'lost' ? lostReason : null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()
    const agentSlug = body.agentSlug || process.env.DEFAULT_AGENT_SLUG || null

    // Save lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        agent_slug: agentSlug,
        zipcode: body.zipcode,
        county: body.county,
        state: body.state || 'FL',
        household_size: body.householdSize,
        annual_income: body.annualIncome,
        fpl_percentage: body.fplPercentage,
        aptc_estimate: body.aptcEstimate || 0,
        ages: body.ages,
        genders: body.genders || "",
        uses_tobacco: body.usesTobacco || false,
        household_members: body.householdMembers || null,
        language: body.language || 'es',
        contact_name: body.contactName,
        contact_phone: body.contactPhone,
        contact_email: body.contactEmail || null,
        status: 'new',
        utm_source: body.utmSource || null,
        utm_medium: body.utmMedium || null,
        utm_campaign: body.utmCampaign || null,
      })
      .select()
      .single()

    if (leadError) {
      console.error('Lead insert error:', leadError)
      return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
    }

    // Track page view
    await supabase.from('page_views').insert({
      agent_slug: agentSlug,
      page: '/cotizar',
      referrer: body.referrer || null,
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
    })

    // Send lead notification email (fire-and-forget)
    const origin = request.headers.get('origin') || request.nextUrl.origin
    fetch(`${origin}/api/notify-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        agentSlug: agentSlug,
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        contactEmail: body.contactEmail || null,
        zipcode: body.zipcode,
        county: body.county,
        state: body.state || 'FL',
        householdSize: body.householdSize,
        annualIncome: body.annualIncome,
        fplPercentage: body.fplPercentage,
      }),
    }).catch((err) => console.error('Lead notification failed:', err))

    return NextResponse.json({ success: true, leadId: lead.id })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
