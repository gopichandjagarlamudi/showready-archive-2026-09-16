import { NextResponse } from "next/server"
import {
  FeedbackSubmissionResponseSchema,
  FeedbackSubmissionSchema
} from "@showready/contracts"
import { ZodError } from "zod"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { recordAgentFeedback } from "@/lib/supabase/data"

function getValidationErrorMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid feedback payload."
}

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const payload = FeedbackSubmissionSchema.parse(await request.json())

    await recordAgentFeedback(createSupabaseAdminClient(), agentId, {
      message: payload.message,
      source: "mobile-settings"
    })

    return NextResponse.json(FeedbackSubmissionResponseSchema.parse({ ok: true }), {
      status: 201
    })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.feedback",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    if (error instanceof ZodError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.feedback",
        status: 400,
        agentId,
        response: { error: getValidationErrorMessage(error) }
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.feedback",
      status: 400,
      agentId,
      response: { error: "Unable to submit feedback." }
    })
  }
}
