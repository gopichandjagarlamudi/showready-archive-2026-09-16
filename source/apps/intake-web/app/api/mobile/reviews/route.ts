import { NextResponse } from "next/server"
import { reviewLeadSubmission } from "@showready/application"
import { ReviewLeadSchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { reviewLead } from "@/lib/supabase/data"

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const authenticatedAgentId = auth.agentId
    const payload = ReviewLeadSchema.parse(await request.json())
    const lead = await reviewLeadSubmission(
      {
        reviewLead: (leadId, pipelineStage) =>
          reviewLead(auth.client, authenticatedAgentId, leadId, pipelineStage)
      },
      payload.leadId,
      payload.pipelineStage
    )

    return NextResponse.json({ lead })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.reviews",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.reviews",
      status: 400,
      agentId,
      response: { error: "Unable to review lead." }
    })
  }
}
