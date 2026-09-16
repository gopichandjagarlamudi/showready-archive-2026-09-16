import { z } from "zod"
import { NextResponse } from "next/server"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { registerAgentPushToken } from "@/lib/supabase/data"

const PushTokenSchema = z.strictObject({
  expoPushToken: z.string().trim().min(1).max(256),
  platform: z.enum(["ios", "android", "unknown"])
})

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const payload = PushTokenSchema.parse(await request.json())

    await registerAgentPushToken(auth.client, agentId, payload)

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.push-tokens",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.push-tokens",
      status: 400,
      agentId,
      response: { error: "Unable to register push token." }
    })
  }
}
