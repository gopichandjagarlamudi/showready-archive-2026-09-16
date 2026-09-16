import "server-only"

import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "../env"

export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
