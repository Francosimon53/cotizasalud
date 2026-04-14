import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    if (!body.leadId) {
      return NextResponse.json({ error: 'leadId required' }, { status: 400 })
    }

    const plan = body.plan || {};
    const { error } = await supabase
      .from('leads')
      .update({
        selected_plan: plan,
        selected_plan_name: plan.name || null,
        selected_premium: plan.afterSubsidy ?? plan.premium ?? null,
        status: 'quoted',
      })
      .eq('id', body.leadId)

    if (error) {
      console.error('Plan select error:', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
