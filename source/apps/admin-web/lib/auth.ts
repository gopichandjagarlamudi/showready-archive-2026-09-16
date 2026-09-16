import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getAdminOwnerEmail } from "@/lib/env"

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function requireAdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user?.email) redirect("/sign-in")
  if (normalizeEmail(user.email) !== getAdminOwnerEmail()) redirect("/access-denied")

  return user
}
