import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

let admin: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (admin) return admin
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return admin
}

