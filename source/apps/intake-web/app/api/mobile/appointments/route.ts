import { NextResponse } from "next/server"
import { saveAppointment } from "@showready/application"
import { AppointmentListQuerySchema, AppointmentMutationSchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createRouteTiming, jsonWithRouteTiming } from "@/lib/route-timing"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createAppointment, listAppointments, updateAppointment } from "@/lib/supabase/data"

export async function GET(request: Request) {
  let agentId: string | undefined
  const timing = createRouteTiming()

  try {
    const auth = await timing.measure("auth", () => requireMobileAgent(request))
    agentId = auth.agentId
    const authenticatedAgentId = auth.agentId
    const { searchParams } = new URL(request.url)
    const query = AppointmentListQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    )
    const result = await timing.measure("data", () =>
      listAppointments(auth.client, authenticatedAgentId, query)
    )

    return jsonWithRouteTiming(result, timing)
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.appointments",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.appointments",
      status: 400,
      agentId,
      response: { error: "Unable to load appointments." }
    })
  }
}

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const authenticatedAgentId = auth.agentId
    const serviceClient = createSupabaseAdminClient()
    const payload = AppointmentMutationSchema.parse(await request.json())
    const appointment = await saveAppointment(
      {
        saveAppointment: (input) =>
          payload.appointmentId
            ? updateAppointment(serviceClient, authenticatedAgentId, payload.appointmentId as string, input)
            : createAppointment(serviceClient, authenticatedAgentId, input)
      },
      payload
    )

    return NextResponse.json(
      { appointment },
      { status: payload.appointmentId ? 200 : 201 }
    )
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.appointments",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.appointments",
      status: 400,
      agentId,
      response: { error: "Unable to save appointment." }
    })
  }
}
