import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { AccountDeletionRequestSchema } from "@showready/contracts"
import { ZodError } from "zod"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { getClientIp } from "@/lib/rate-limit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  createPrivacyRequest,
  recordAuditEvents,
  recordConsentRecords
} from "@/lib/supabase/data"

function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid account deletion request."
}

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const payload = AccountDeletionRequestSchema.parse(await request.json())
    const admin = createSupabaseAdminClient()
    const requestIp = getClientIp(request)
    const userAgent = request.headers.get("user-agent")?.trim() || undefined
    const privacyRequest = await createPrivacyRequest(admin, {
      agentId,
      requesterEmail: auth.user.email ?? undefined,
      requestType: "account_deletion",
      source: "mobile-settings",
      note: payload.note,
      metadata: {
        requestIp,
        userAgent
      }
    })
    const occurredAt = new Date().toISOString()

    await Promise.all([
      recordConsentRecords(admin, agentId, [
        {
          id: randomUUID(),
          subjectType: "agent",
          subjectId: agentId,
          agentId,
          consentType: "data_delete",
          status: "requested",
          source: "mobile-settings",
          occurredAt,
          metadata: {
            requestId: privacyRequest.id,
            requestType: "account_deletion"
          }
        }
      ]),
      recordAuditEvents(admin, agentId, [
        {
          id: randomUUID(),
          occurredAt,
          action: "privacy.delete_requested",
          actorId: agentId,
          actorType: "agent",
          resourceType: "account",
          resourceId: agentId,
          requestIp,
          userAgent,
          beforeSummary: {},
          afterSummary: {},
          metadata: {
            requestId: privacyRequest.id,
            requestType: "account_deletion"
          }
        }
      ])
    ])

    return NextResponse.json(
      {
        ok: true,
        requestId: privacyRequest.id
      },
      {
        status: 202
      }
    )
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.account-deletion",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    if (error instanceof ZodError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.account-deletion",
        status: 400,
        agentId,
        response: { error: validationMessage(error) }
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.account-deletion",
      status: 400,
      agentId,
      response: { error: "Unable to request account deletion." }
    })
  }
}
