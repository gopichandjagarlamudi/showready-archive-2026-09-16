import { NextResponse } from "next/server"
import { submitIntakeDraft } from "@showready/application"
import {
  PublicIntakePayloadSchema,
  ResourceIdSchema,
  type IntakeDraft
} from "@showready/contracts"
import { captureServerError, requestErrorResponse } from "@/lib/observability"
import {
  assertPublicIntakePayloadAllowed,
  guardPublicIntakeRequest
} from "@/lib/public-intake-guard"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  enqueueOutboxJobs,
  submitInvite
} from "@/lib/supabase/data"
import { buildAppUrl } from "@/lib/utils"

function scoreBand(score: number) {
  if (score >= 8) {
    return "high"
  }

  if (score >= 5) {
    return "medium"
  }

  return "low"
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const guard = await guardPublicIntakeRequest(request, token, "submit")

  if (!guard.ok) {
    return requestErrorResponse({
      request,
      error: new Error(guard.error),
      route: "api.intake.submit",
      status: guard.status,
      response: { error: guard.error },
      headers: guard.headers,
      context: { stage: "guard" }
    })
  }

  const tokenResult = ResourceIdSchema.safeParse(token)
  if (!tokenResult.success) {
    return requestErrorResponse({
      request,
      error: tokenResult.error,
      route: "api.intake.submit",
      status: 400,
      response: { error: "Invalid intake token." },
      context: { stage: "token" }
    })
  }

  let payload: { draft: IntakeDraft }

  try {
    payload = PublicIntakePayloadSchema.parse(await request.json()) as { draft: IntakeDraft }
    assertPublicIntakePayloadAllowed(payload, "submit")
  } catch (error) {
    return requestErrorResponse({
      request,
      error,
      route: "api.intake.submit",
      status: 400,
      response: { error: error instanceof Error ? error.message : "Unable to submit intake." },
      context: { stage: "validation" }
    })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const { lead } = await submitIntakeDraft(
      {
        submitDraft: (inviteToken, draft) => submitInvite(supabase, inviteToken, { draft })
      },
      tokenResult.data,
      payload.draft
    )
    try {
      await enqueueOutboxJobs(supabase, lead.agentId, [
        {
          jobType: "intake.submitted.product_event",
          resourceType: "lead",
          resourceId: lead.id,
          payload: {
            recommendation: lead.recommendation ?? "nurture",
            scoreBand: scoreBand(lead.score ?? 0)
          }
        },
        {
          jobType: "intake.submitted.push_notifications",
          resourceType: "lead",
          resourceId: lead.id,
          payload: {
            title: "New lead submitted",
            body: `${lead.buyerName} just submitted the intake form.`,
            route: "/(app)/new-leads"
          }
        },
        {
          jobType: "intake.submitted.email",
          resourceType: "lead",
          resourceId: lead.id,
          payload: {
            detailUrl: buildAppUrl(`/leads/${lead.id}`, { request })
          }
        },
        {
          jobType: "intake.submitted.analytics",
          resourceType: "lead",
          resourceId: lead.id,
          payload: {
            recommendation: lead.recommendation ?? "nurture"
          }
        }
      ])
    } catch (error) {
      captureServerError(error, "api.intake.submit.outbox")
    }

    return NextResponse.json({ lead })
  } catch (error) {
    return requestErrorResponse({
      request,
      error,
      route: "api.intake.submit",
      status: 400,
      response: { error: "Unable to submit intake." },
      context: { stage: "persistence" }
    })
  }
}
