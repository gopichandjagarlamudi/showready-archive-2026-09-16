import { NextResponse } from "next/server"
import { ProductEventBatchSchema } from "@showready/contracts"
import { ZodError } from "zod"
import { sanitizeEventMetadata } from "@/lib/events/redaction"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { recordProductEvents } from "@/lib/supabase/data"

function getValidationErrorMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid product event payload."
}

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const payload = ProductEventBatchSchema.parse(await request.json())
    const sanitizedEvents = payload.events.map((event) => ({
      ...event,
      agentId,
      actorId: agentId,
      properties: sanitizeEventMetadata(event.properties)
    }))
    const result = await recordProductEvents(createSupabaseAdminClient(), agentId, sanitizedEvents)

    return NextResponse.json(result, {
      status: 202
    })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.events",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    if (error instanceof ZodError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.events",
        status: 400,
        agentId,
        response: { error: getValidationErrorMessage(error) }
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.events",
      status: 400,
      agentId,
      response: { error: "Unable to record product events." }
    })
  }
}
