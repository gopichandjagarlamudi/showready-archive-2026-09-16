import { NextResponse } from "next/server"
import { LeadMutationSchema, ResourceIdSchema } from "@showready/contracts"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { deleteLead, getLeadById, updateLeadContact } from "@/lib/supabase/data"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  let agentId: string | undefined

  try {
    const { leadId } = await params
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const parsedLeadId = ResourceIdSchema.parse(leadId)
    const lead = await getLeadById(createSupabaseAdminClient(), agentId, parsedLeadId)

    if (!lead) {
      return requestErrorResponse({
        request,
        error: new Error("Lead not found."),
        route: "api.mobile.leads.detail",
        status: 404,
        agentId,
        context: { leadId: parsedLeadId },
        response: { error: "Lead not found." }
      })
    }

    return NextResponse.json({ lead })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.leads.detail",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.leads.detail",
      status: 400,
      agentId,
      response: { error: "Unable to load lead." }
    })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  let agentId: string | undefined

  try {
    const { leadId } = await params
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const parsedLeadId = ResourceIdSchema.parse(leadId)
    const payload = LeadMutationSchema.parse(await request.json())
    const lead = await updateLeadContact(createSupabaseAdminClient(), agentId, parsedLeadId, payload)

    if (!lead) {
      return requestErrorResponse({
        request,
        error: new Error("Lead not found."),
        route: "api.mobile.leads.detail",
        status: 404,
        agentId,
        context: { leadId: parsedLeadId },
        response: { error: "Lead not found." }
      })
    }

    return NextResponse.json({ lead })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.leads.detail",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.leads.detail",
      status: 400,
      agentId,
      response: { error: "Unable to update lead." }
    })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  let agentId: string | undefined

  try {
    const { leadId } = await params
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const parsedLeadId = ResourceIdSchema.parse(leadId)
    const deleted = await deleteLead(createSupabaseAdminClient(), agentId, parsedLeadId)

    if (!deleted) {
      return requestErrorResponse({
        request,
        error: new Error("Lead not found."),
        route: "api.mobile.leads.detail",
        status: 404,
        agentId,
        context: { leadId: parsedLeadId },
        response: { error: "Lead not found." }
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.leads.detail",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.leads.detail",
      status: 400,
      agentId,
      response: { error: "Unable to delete lead." }
    })
  }
}
