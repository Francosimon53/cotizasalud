// Helpers to save cotizar data to Supabase via the public API routes.
//
// Every write goes through postLeadWrite: response.ok is always checked, a
// failed request is retried once after 2s, and a final failure is reported to
// Sentry with endpoint/leadId/status context so nothing fails silently. The
// per-lead capability token (returned by /api/leads/browse and POST
// /api/leads) is sent in the x-lead-token header — the write endpoints reject
// requests without it.
import * as Sentry from '@sentry/nextjs'

const RETRY_DELAY_MS = 2000

export interface LeadWriteResult {
  ok: boolean
  status: number
  json: any
}

async function postJsonOnce(
  url: string,
  body: unknown,
  leadToken?: string | null
): Promise<LeadWriteResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (leadToken) headers['x-lead-token'] = leadToken
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  let json: any = null
  try {
    json = await res.json()
  } catch {
    // Non-JSON body (e.g. gateway error page) — status alone is enough.
  }
  return { ok: res.ok, status: res.status, json }
}

// POST with one automatic retry. Never throws: a network error counts as a
// failed attempt and the final failure is captured in Sentry.
export async function postLeadWrite(
  url: string,
  body: unknown,
  opts: { leadToken?: string | null; leadId?: string | null } = {}
): Promise<LeadWriteResult> {
  let last: LeadWriteResult | null = null
  let lastNetworkError: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    try {
      last = await postJsonOnce(url, body, opts.leadToken)
      if (last.ok) return last
    } catch (err) {
      lastNetworkError = err
      last = null
    }
  }

  Sentry.captureException(
    lastNetworkError ?? new Error(`Lead write failed: POST ${url} → ${last?.status}`),
    {
      extra: {
        endpoint: url,
        leadId: opts.leadId ?? null,
        status: last?.status ?? null,
        responseError: last?.json?.error ?? null,
      },
    }
  )
  return last ?? { ok: false, status: 0, json: null }
}

export async function saveLead(data: {
  agentSlug?: string
  zipcode: string
  county: string
  state: string
  householdSize: number
  annualIncome: number
  fplPercentage: number
  aptcEstimate?: number
  ages: string
  usesTobacco: boolean
  language: string
  contactName: string
  contactPhone: string
  contactEmail?: string
  dob?: string
  streetAddress?: string
  city?: string
  stateForm?: string
  aptNumber?: string
  currentInsurance?: string
  currentInsuranceName?: string
  contactPreference?: string
  bestCallTime?: string
  householdDobs?: string
  householdMembers?: any[]
  genders?: string
  signatureData?: string
  immigrationStatus?: string
  consentTimestamp?: string
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): Promise<{ success: boolean; leadId?: string; clientToken?: string; error?: string }> {
  const res = await postLeadWrite('/api/leads', data)
  if (!res.ok) return { success: false, error: res.json?.error || 'Network error' }
  return { success: true, leadId: res.json?.leadId, clientToken: res.json?.clientToken }
}

export async function saveConsent(
  data: {
    leadId?: string
    consumerName: string
    consumerPhone?: string
    consumerEmail?: string
    consumerDob?: string
    consumerIncome?: number
    typedSignature: string
    consentDate: string
    agentName: string
    agentNpn?: string
    agentPhone?: string
    planName?: string
    planPremium?: number
    planDeductible?: number
    planMaxOop?: number
    effectiveDate?: string
  },
  leadToken?: string | null
): Promise<{ success: boolean; consentId?: string }> {
  const res = await postLeadWrite('/api/consents', data, {
    leadToken: data.leadId ? leadToken : null,
    leadId: data.leadId ?? null,
  })
  return { success: res.ok, consentId: res.json?.consentId }
}

export interface SelectedPlanPayload {
  id?: string
  name?: string
  issuer?: string
  metal?: string
  premium?: number
  afterSubsidy?: number
  deductible?: number
  oopMax?: number
  effectiveDate?: string
}

export async function savePlanSelection(
  leadId: string,
  plan: SelectedPlanPayload,
  leadToken?: string | null
): Promise<boolean> {
  const res = await postLeadWrite('/api/plan-select', { leadId, plan }, { leadToken, leadId })
  return res.ok
}

export async function logAIQuery(data: {
  leadId?: string
  planName?: string
  planId?: string
  question: string
  response: string
  model?: string
  responseTimeMs?: number
}): Promise<void> {
  try {
    await fetch('/api/ai-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch {
    console.error('Failed to log AI query')
  }
}
