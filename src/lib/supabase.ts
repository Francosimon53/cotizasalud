import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Server-side (bypasses RLS) — only use in API routes
export function createServiceClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
