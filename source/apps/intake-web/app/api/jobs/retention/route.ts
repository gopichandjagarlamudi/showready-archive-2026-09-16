import { NextResponse } from "next/server"
import { isAuthorizedJobRequest } from "@/lib/job-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { runRetentionCleanup } from "@/lib/supabase/data"

async function handleRetentionCleanup(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return requestErrorResponse({
      request,
      error: new Error("Unauthorized retention job request."),
      route: "api.jobs.retention",
      status: 401,
      response: { error: "Unauthorized." }
    })
  }

  try {
    const cleanup = await runRetentionCleanup(createSupabaseAdminClient())

    return NextResponse.json({ cleanup })
  } catch (error) {
    return requestErrorResponse({
      request,
      error,
      route: "api.jobs.retention",
      status: 500,
      response: { error: "Unable to run retention cleanup." }
    })
  }
}

export async function GET(request: Request) {
  return handleRetentionCleanup(request)
}

export async function POST(request: Request) {
  return handleRetentionCleanup(request)
}
