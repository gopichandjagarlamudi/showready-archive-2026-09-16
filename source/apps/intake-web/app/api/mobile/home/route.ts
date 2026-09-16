import { HomeDataResponseSchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createRouteTiming, jsonWithRouteTiming } from "@/lib/route-timing"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getAnalyticsSummary, listRecentLeads } from "@/lib/supabase/data"

export async function GET(request: Request) {
  let agentId: string | undefined
  const timing = createRouteTiming()

  try {
    const auth = await timing.measure("auth", () => requireMobileAgent(request))
    agentId = auth.agentId
    const authenticatedAgentId = auth.agentId
    const serviceClient = createSupabaseAdminClient()
    const [summary, recentLeads] = await timing.measure("data", () =>
      Promise.all([
        getAnalyticsSummary(serviceClient, authenticatedAgentId),
        listRecentLeads(auth.client, authenticatedAgentId, 4)
      ])
    )

    return jsonWithRouteTiming(
      HomeDataResponseSchema.parse({
        summary,
        recentLeads
      }),
      timing
    )
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.home",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.home",
      status: 400,
      agentId,
      response: { error: "Unable to load home data." }
    })
  }
}
