import "react-native-url-polyfill/auto"
import { createClient } from "@supabase/supabase-js"
import { authStorage } from "./auth-storage"
import { getSupabaseAnonKey, getSupabaseUrl } from "./env"

export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: {
    storage: authStorage,
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false
  }
})
