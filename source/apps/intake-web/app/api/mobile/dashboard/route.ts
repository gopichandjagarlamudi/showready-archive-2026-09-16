import { loadDashboardSummary } from "@showready/application"
import { DashboardSummarySchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createRouteTiming, jsonWithRouteTiming } from "@/lib/route-timing"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getAnalyticsSummary } from "@/lib/supabase/data"

export async function GET(request: Request) {
  let agentId: string | undefined
  const timing = createRouteTiming()

  try {
    const auth = await timing.measure("auth", () => requireMobileAgent(request))
    agentId = auth.agentId
    const authenticatedAgentId = auth.agentId
    const serviceClient = createSupabaseAdminClient()
    const summary = await timing.measure("data", () =>
      loadDashboardSummary({
        getDashboardSummary: () => getAnalyticsSummary(serviceClient, authenticatedAgentId)
      })
    )

    return jsonWithRouteTiming(DashboardSummarySchema.parse(summary), timing)
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.dashboard",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.dashboard",
      status: 400,
      agentId,
      response: { error: "Unable to load dashboard summary." }
    })
  }
}
