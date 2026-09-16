import { NextResponse } from "next/server"
import { autosaveIntakeStep } from "@showready/application"
import {
  PublicIntakePayloadSchema,
  ResourceIdSchema,
  type IntakeDraft
} from "@showready/contracts"
import { requestErrorResponse } from "@/lib/observability"
import {
  assertPublicIntakePayloadAllowed,
  guardPublicIntakeRequest
} from "@/lib/public-intake-guard"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { autosaveInviteDraft } from "@/lib/supabase/data"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const guard = await guardPublicIntakeRequest(request, token, "autosave")

  if (!guard.ok) {
    return requestErrorResponse({
      request,
      error: new Error(guard.error),
      route: "api.intake.autosave",
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
      route: "api.intake.autosave",
      status: 400,
      response: { error: "Invalid intake token." },
      context: { stage: "token" }
    })
  }

  let payload: { draft: IntakeDraft }

  try {
    payload = PublicIntakePayloadSchema.parse(await request.json()) as { draft: IntakeDraft }
    assertPublicIntakePayloadAllowed(payload, "autosave")
  } catch (error) {
    return requestErrorResponse({
      request,
      error,
      route: "api.intake.autosave",
      status: 400,
      response: { error: error instanceof Error ? error.message : "Unable to save answer." },
      context: { stage: "validation" }
    })
  }

  try {
    const supabase = createSupabaseAdminClient()
    await autosaveIntakeStep(
      {
        autosaveDraft: (inviteToken, draft) =>
          autosaveInviteDraft(supabase, inviteToken, draft).then(() => ({ ok: true as const }))
      },
      tokenResult.data,
      payload.draft
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return requestErrorResponse({
      request,
      error,
      route: "api.intake.autosave",
      status: 400,
      response: { error: "Unable to save answer." },
      context: { stage: "persistence" }
    })
  }
}
