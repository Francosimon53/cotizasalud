import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveAgentFromSlug } from '@/lib/resolve-agent'
import { normalizeAgentSlug } from '@/lib/normalize-slug'

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
    if (body.dob) update.dob = body.dob
    if (body.streetAddress) update.street_address = body.streetAddress
    if (body.city) update.city = body.city
    if (body.stateForm) update.state_form = body.stateForm
    if (body.aptNumber !== undefined) update.apt_number = body.aptNumber
    if (body.currentInsurance) update.current_insurance = body.currentInsurance
    if (body.currentInsuranceName !== undefined) update.current_insurance_name = body.currentInsuranceName
    if (body.contactPreference) update.contact_preference = body.contactPreference
    if (body.bestCallTime) update.best_call_time = body.bestCallTime
    if (body.householdDobs) update.household_dobs = body.householdDobs
    if (body.householdMembers) update.household_members = body.householdMembers
    if (body.genders) update.genders = body.genders
    if (body.signatureData) update.signature_data = body.signatureData
    if (body.signatureData) update.consent_ip = request.headers.get('x-forwarded-for') || ''
    if (body.consentTimestamp) update.consent_timestamp = body.consentTimestamp

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
    const slugResult = normalizeAgentSlug(body.agentSlug)
    const slug = slugResult.ok
      ? slugResult.slug
      : (process.env.DEFAULT_AGENT_SLUG?.trim() || 'delbert')
    const { agent_id, agent_slug } = await resolveAgentFromSlug(
      supabase,
      slug,
      { zipcode: body.zipcode, source: 'api/leads POST' }
    )

    // Save lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        agent_id,
        agent_slug,
        zipcode: body.zipcode,
        county: body.county,
        state: body.state || 'FL',
        household_size: body.householdSize,
        annual_income: body.annualIncome,
        fpl_percentage: body.fplPercentage,
        aptc_estimate: body.aptcEstimate || 0,
        ages: body.ages,
        uses_tobacco: body.usesTobacco || false,
        dob: body.dob || '',
        street_address: body.streetAddress || '',
        city: body.city || '',
        state_form: body.stateForm || '',
        apt_number: body.aptNumber || '',
        current_insurance: body.currentInsurance || '',
        current_insurance_name: body.currentInsuranceName || '',
        contact_preference: body.contactPreference || '',
        best_call_time: body.bestCallTime || '',
        household_dobs: body.householdDobs || '',
        household_members: body.householdMembers || null,
        genders: body.genders || '',
        signature_data: body.signatureData || '',
        consent_ip: request.headers.get('x-forwarded-for') || '',
        consent_timestamp: body.consentTimestamp || new Date().toISOString(),
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
      agent_slug,
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
        agentSlug: agent_slug,
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
