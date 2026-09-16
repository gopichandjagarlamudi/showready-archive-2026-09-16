import { NextResponse } from "next/server"
import { AuditEventBatchSchema } from "@showready/contracts"
import { ZodError } from "zod"
import { sanitizeEventMetadata } from "@/lib/events/redaction"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { getClientIp } from "@/lib/rate-limit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { recordAuditEvents } from "@/lib/supabase/data"

function getValidationErrorMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid audit event payload."
}

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const payload = AuditEventBatchSchema.parse(await request.json())
    const requestIp = getClientIp(request)
    const userAgent = request.headers.get("user-agent")?.trim() || undefined
    const sanitizedEvents = payload.events.map((event) => ({
      ...event,
      agentId,
      actorId: agentId,
      actorType: "agent" as const,
      requestIp,
      userAgent,
      beforeSummary: sanitizeEventMetadata(event.beforeSummary),
      afterSummary: sanitizeEventMetadata(event.afterSummary),
      metadata: sanitizeEventMetadata(event.metadata)
    }))
    const result = await recordAuditEvents(createSupabaseAdminClient(), agentId, sanitizedEvents)

    return NextResponse.json(result, {
      status: 202
    })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.audit-events",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    if (error instanceof ZodError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.audit-events",
        status: 400,
        agentId,
        response: { error: getValidationErrorMessage(error) }
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.audit-events",
      status: 400,
      agentId,
      response: { error: "Unable to record audit events." }
    })
  }
}
