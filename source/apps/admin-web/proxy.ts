import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.getUser()
  return NextResponse.next({ request })
}
