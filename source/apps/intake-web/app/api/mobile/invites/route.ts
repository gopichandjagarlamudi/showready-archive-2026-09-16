import { NextResponse } from "next/server"
import { createInviteLink } from "@showready/application"
import { serializeInviteResponse } from "@/lib/invite-response"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createInvite, getAgentProfile } from "@/lib/supabase/data"
import { buildAppUrl } from "@/lib/utils"

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const authenticatedAgentId = auth.agentId
    const payload = await createInviteLink({
      createInvite: async () => {
        const [invite, agent] = await Promise.all([
          createInvite(auth.client, authenticatedAgentId),
          getAgentProfile(auth.client, authenticatedAgentId)
        ])

        return serializeInviteResponse({
          token: invite.token,
          tokenExpiresAt: invite.tokenExpiresAt,
          appUrl: buildAppUrl("", { request }),
          agentName: agent?.fullName
        })
      }
    })

    return NextResponse.json(payload, {
      status: 201
    })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.invites",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.invites",
      status: 400,
      agentId,
      response: { error: "Unable to create invite." }
    })
  }
}
