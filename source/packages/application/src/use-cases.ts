import type {
  AdminDashboardRangeDays,
  AdminAgentListQuery,
  AdminFeedbackListQuery,
  AppointmentStatus,
  IntakeDraft,
  LeadStage
} from "@showready/contracts"
import type {
  AdminDashboardGateway,
  AppointmentGateway,
  DashboardGateway,
  IntakeGateway,
  InviteGateway,
  ReviewGateway,
  SettingsGateway
} from "./ports"

export async function loadDashboardSummary(gateway: DashboardGateway) {
  return gateway.getDashboardSummary()
}

export async function createInviteLink(gateway: InviteGateway) {
  return gateway.createInvite()
}

export async function reviewLeadSubmission(
  gateway: ReviewGateway,
  leadId: string,
  pipelineStage: Extract<LeadStage, "ready_to_show" | "nurture" | "hold">
) {
  if (
    pipelineStage !== "ready_to_show" &&
    pipelineStage !== "nurture" &&
    pipelineStage !== "hold"
  ) {
    throw new Error("Review stage must be ready_to_show, nurture, or hold.")
  }

  return gateway.reviewLead(leadId, pipelineStage)
}

export async function autosaveIntakeStep(
  gateway: Pick<IntakeGateway, "autosaveDraft">,
  token: string,
  draft: IntakeDraft
) {
  return gateway.autosaveDraft(token, draft)
}

export async function submitIntakeDraft(
  gateway: Pick<IntakeGateway, "submitDraft">,
  token: string,
  draft: IntakeDraft
) {
  return gateway.submitDraft(token, draft)
}

export async function saveAppointment(
  gateway: Pick<AppointmentGateway, "saveAppointment">,
  input: {
    appointmentId?: string
    leadId: string
    date: string
    startTime: string
    notes?: string
    showings: {
      address: string
      notes?: string
    }[]
  }
) {
  return gateway.saveAppointment(input)
}

export async function saveAppointmentStatus(
  gateway: Pick<AppointmentGateway, "updateAppointmentStatus">,
  appointmentId: string,
  status: AppointmentStatus
) {
  return gateway.updateAppointmentStatus(appointmentId, status)
}

export async function saveSettingsProfile(
  gateway: SettingsGateway,
  input: {
    fullName: string
    brokerage?: string
    licenseNumber?: string
    emailNotificationsEnabled: boolean
  }
) {
  return gateway.saveSettings(input)
}

export async function getAdminDashboardOverview(
  gateway: Pick<AdminDashboardGateway, "getOverview">,
  rangeDays: AdminDashboardRangeDays
) {
  return gateway.getOverview(rangeDays)
}

export async function listAdminAgents(
  gateway: Pick<AdminDashboardGateway, "listAgents">,
  input: AdminAgentListQuery
) {
  return gateway.listAgents(input)
}

export async function getAdminAgentDetail(
  gateway: Pick<AdminDashboardGateway, "getAgentDetail">,
  agentId: string,
  rangeDays: AdminDashboardRangeDays
) {
  return gateway.getAgentDetail(agentId, rangeDays)
}

export async function listAdminFeedback(
  gateway: Pick<AdminDashboardGateway, "listFeedback">,
  input: AdminFeedbackListQuery
) {
  return gateway.listFeedback(input)
}
