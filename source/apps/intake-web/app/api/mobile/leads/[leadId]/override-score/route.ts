import { NextResponse } from "next/server"
import { z } from "zod"
import { ResourceIdSchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { overrideLeadScore } from "@/lib/supabase/data"

const OverrideSchema = z.strictObject({
  overrideScore: z.number().min(0).max(10),
  note: z.string().trim().min(1).max(1000)
})

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
    const payload = OverrideSchema.parse(await request.json())
    const lead = await overrideLeadScore(
      auth.client,
      agentId,
      parsedLeadId,
      payload.overrideScore,
      payload.note
    )

    return NextResponse.json({ lead })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.leads.override-score",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.leads.override-score",
      status: 400,
      agentId,
      response: { error: "Unable to override score." }
    })
  }
}
