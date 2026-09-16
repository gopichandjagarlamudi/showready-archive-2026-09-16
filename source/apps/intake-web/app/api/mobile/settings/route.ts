import { NextResponse } from "next/server"
import { saveSettingsProfile } from "@showready/application"
import { SettingsMutationSchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { completeOnboarding, getAgentContext } from "@/lib/supabase/data"

export async function GET(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const context = await getAgentContext(auth.client, agentId)

    if (!context) {
      return requestErrorResponse({
        request,
        error: new Error("Agent settings not found."),
        route: "api.mobile.settings",
        status: 404,
        agentId,
        response: { error: "Agent settings not found." }
      })
    }

    return NextResponse.json({
      fullName: context.agent.fullName,
      brokerage: context.agent.brokerage,
      licenseNumber: context.agent.licenseNumber,
      emailNotificationsEnabled: context.settings.emailNotificationsEnabled,
      brandName: context.settings.brandName,
      brandColor: context.settings.brandColor,
      accentColor: context.settings.accentColor,
      showThreshold: context.settings.showThreshold
    })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.settings",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.settings",
      status: 400,
      agentId,
      response: { error: "Unable to load settings." }
    })
  }
}

export async function PUT(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const authenticatedAgentId = auth.agentId
    const payload = SettingsMutationSchema.parse(await request.json())
    const existingContext = await getAgentContext(auth.client, agentId)

    if (!existingContext) {
      return requestErrorResponse({
        request,
        error: new Error("Agent settings are not ready yet."),
        route: "api.mobile.settings",
        status: 404,
        agentId,
        response: { error: "Agent settings are not ready yet." }
      })
    }

    await saveSettingsProfile(
      {
        saveSettings: async (input) => {
          await completeOnboarding(auth.client, authenticatedAgentId, {
            ...input,
            brandName: existingContext.settings.brandName,
            brandColor: existingContext.settings.brandColor,
            accentColor: existingContext.settings.accentColor,
            showThreshold: existingContext.settings.showThreshold,
            intakeType: existingContext.template.intakeType,
            introHeadline: existingContext.template.introHeadline,
            introBody: existingContext.template.introBody,
            customQuestions: existingContext.template.customQuestions
          })

          return { ok: true as const }
        }
      },
      payload
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.settings",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.settings",
      status: 400,
      agentId,
      response: { error: "Unable to save settings." }
    })
  }
}
