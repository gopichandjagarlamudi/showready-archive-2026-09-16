import { NextResponse } from "next/server"
import { ConsentRecordBatchSchema } from "@showready/contracts"
import { ZodError } from "zod"
import { sanitizeEventMetadata } from "@/lib/events/redaction"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { recordConsentRecords } from "@/lib/supabase/data"

function getValidationErrorMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid consent record payload."
}

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const payload = ConsentRecordBatchSchema.parse(await request.json())
    const sanitizedRecords = payload.records.map((record) => ({
      ...record,
      agentId,
      subjectId: record.subjectType === "agent" ? agentId : record.subjectId,
      metadata: sanitizeEventMetadata(record.metadata)
    }))
    const result = await recordConsentRecords(createSupabaseAdminClient(), agentId, sanitizedRecords)

    return NextResponse.json(result, {
      status: 202
    })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.consent-records",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    if (error instanceof ZodError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.consent-records",
        status: 400,
        agentId,
        response: { error: getValidationErrorMessage(error) }
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.consent-records",
      status: 400,
      agentId,
      response: { error: "Unable to record consent records." }
    })
  }
}
