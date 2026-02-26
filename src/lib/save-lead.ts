// Helper to save lead data to Supabase via API route
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
  referrer?: string
}): Promise<{ success: boolean; leadId?: string; error?: string }> {
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) return { success: false, error: json.error }
    return { success: true, leadId: json.leadId }
  } catch (err) {
    console.error('saveLead error:', err)
    return { success: false, error: 'Network error' }
  }
}

export async function saveConsent(data: {
  leadId?: string
  consumerName: string
  consumerSignature: string
  consentDate: string
  consentDuration: string
  authSearch: boolean
  authEnrollment: boolean
  authMaintenance: boolean
  authInquiries: boolean
  eligibilityVerified: boolean
  agentName: string
  agentNpn?: string
}): Promise<{ success: boolean; consentId?: string }> {
  try {
    const res = await fetch('/api/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    return { success: res.ok, consentId: json.consentId }
  } catch {
    return { success: false }
  }
}

export async function savePlanSelection(leadId: string, plan: any): Promise<void> {
  try {
    await fetch('/api/plan-select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, plan }),
    })
  } catch {
    console.error('Failed to save plan selection')
  }
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
