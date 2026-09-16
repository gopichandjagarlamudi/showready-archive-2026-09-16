import { NextResponse } from "next/server"
import { LeadStageMutationSchema, ResourceIdSchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { updateLeadStage } from "@/lib/supabase/data"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  let agentId: string | undefined

  try {
    const { leadId } = await params
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const parsedLeadId = ResourceIdSchema.parse(leadId)
    const payload = LeadStageMutationSchema.parse(await request.json())
    const lead = await updateLeadStage(auth.client, agentId, parsedLeadId, payload.pipelineStage)

    return NextResponse.json({ lead })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.leads.stage",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.leads.stage",
      status: 400,
      agentId,
      response: { error: "Unable to move lead." }
    })
  }
}
