import { NextResponse } from "next/server"
import { AppointmentStatusSchema, ResourceIdSchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { updateAppointmentStatus } from "@/lib/supabase/data"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  let agentId: string | undefined

  try {
    const { appointmentId } = await params
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const serviceClient = createSupabaseAdminClient()
    const parsedAppointmentId = ResourceIdSchema.parse(appointmentId)
    const payload = AppointmentStatusSchema.parse({
      ...(await request.json()),
      appointmentId: parsedAppointmentId
    })
    const appointment = await updateAppointmentStatus(
      serviceClient,
      agentId,
      payload.appointmentId,
      payload.status
    )

    return NextResponse.json({ appointment })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.appointments.status",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.appointments.status",
      status: 400,
      agentId,
      response: { error: "Unable to update appointment status." }
    })
  }
}
