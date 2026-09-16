import { NextResponse } from "next/server"
import {
  LeadContactInteractionCreateSchema,
  ResourceIdSchema
} from "@showready/contracts"
import { ZodError } from "zod"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { recordLeadContactInteraction } from "@/lib/supabase/data"

function getValidationErrorMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid contact interaction payload."
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  let agentId: string | undefined

  try {
    const { leadId } = await params
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const parsedLeadId = ResourceIdSchema.parse(leadId)
    const payload = LeadContactInteractionCreateSchema.parse(await request.json())
    const interaction = await recordLeadContactInteraction(
      createSupabaseAdminClient(),
      agentId,
      parsedLeadId,
      payload.method
    )

    return NextResponse.json({ interaction }, { status: 201 })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.leads.contact-interactions",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    if (error instanceof ZodError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.leads.contact-interactions",
        status: 400,
        agentId,
        response: { error: getValidationErrorMessage(error) }
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.leads.contact-interactions",
      status: 400,
      agentId,
      response: { error: "Unable to record contact interaction." }
    })
  }
}
