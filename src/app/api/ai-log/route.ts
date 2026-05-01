import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimit(`ai-log:${ip}`, { max: 20, windowMs: 60_000 }).limited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const supabase = createServiceClient()

    await supabase.from('ai_queries').insert({
      lead_id: body.leadId || null,
      agent_id: body.agentId || null,
      plan_name: body.planName || null,
      plan_id: body.planId || null,
      question: body.question,
      response: body.response,
      tokens_input: body.tokensInput || null,
      tokens_output: body.tokensOutput || null,
      model: body.model || 'claude-haiku-4-5',
      response_time_ms: body.responseTimeMs || null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('AI log error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
