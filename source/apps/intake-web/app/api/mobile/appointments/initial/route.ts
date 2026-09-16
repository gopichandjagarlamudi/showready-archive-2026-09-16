import { z } from "zod"
import {
  AppointmentInitialDataResponseSchema,
  AppointmentListQuerySchema
} from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createRouteTiming, jsonWithRouteTiming } from "@/lib/route-timing"
import {
  listAppointmentEligibleLeadSuggestions,
  listAppointments
} from "@/lib/supabase/data"

const LeadLimitSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return 3
    }

    return Math.min(Number(value), 10)
  },
  z.number().int().min(1).max(10)
)

export async function GET(request: Request) {
  let agentId: string | undefined
  const timing = createRouteTiming()

  try {
    const auth = await timing.measure("auth", () => requireMobileAgent(request))
    agentId = auth.agentId
    const authenticatedAgentId = auth.agentId
    const { searchParams } = new URL(request.url)
    const query = AppointmentListQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined
    })
    const leadLimit = LeadLimitSchema.parse(searchParams.get("leadLimit"))
    const [appointments, leadPage] = await timing.measure("data", () =>
      Promise.all([
        listAppointments(auth.client, authenticatedAgentId, query),
        listAppointmentEligibleLeadSuggestions(auth.client, authenticatedAgentId, leadLimit)
      ])
    )

    return jsonWithRouteTiming(
      AppointmentInitialDataResponseSchema.parse({
        appointments,
        eligibleLeads: leadPage
      }),
      timing
    )
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.appointments.initial",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.appointments.initial",
      status: 400,
      agentId,
      response: { error: "Unable to load appointment data." }
    })
  }
}
