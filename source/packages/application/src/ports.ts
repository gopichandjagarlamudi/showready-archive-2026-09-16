import type {
  AdminAgentDetail,
  AdminAgentList,
  AdminAgentListQuery,
  AdminDashboardOverview,
  AdminDashboardRangeDays,
  AdminFeedbackList,
  AdminFeedbackListQuery,
  Appointment,
  AppointmentStatus,
  DashboardSummary,
  IntakeDraft,
  Lead,
  LeadStage
} from "@showready/contracts"

export type DashboardGateway = {
  getDashboardSummary(): Promise<DashboardSummary>
}

export type InviteGateway = {
  createInvite(): Promise<{
    token: string
    shareUrl: string
    expiresAt: string
    agentName?: string
  }>
}

export type ReviewGateway = {
  reviewLead(
    leadId: string,
    pipelineStage: Extract<LeadStage, "ready_to_show" | "nurture" | "hold">
  ): Promise<Lead>
}

export type IntakeGateway = {
  autosaveDraft(token: string, draft: IntakeDraft): Promise<{ ok: true }>
  submitDraft(token: string, draft: IntakeDraft): Promise<{ lead: Lead }>
}

export type AppointmentGateway = {
  saveAppointment(input: {
    appointmentId?: string
    leadId: string
    date: string
    startTime: string
    notes?: string
    showings: {
      address: string
      notes?: string
    }[]
  }): Promise<Appointment>
  updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus
  ): Promise<Appointment>
}

export type SettingsGateway = {
  saveSettings(input: {
    fullName: string
    brokerage?: string
    licenseNumber?: string
    emailNotificationsEnabled: boolean
  }): Promise<{ ok: true }>
}

export type AdminDashboardGateway = {
  getOverview(rangeDays: AdminDashboardRangeDays): Promise<AdminDashboardOverview>
  listAgents(input: AdminAgentListQuery): Promise<AdminAgentList>
  getAgentDetail(agentId: string, rangeDays: AdminDashboardRangeDays): Promise<AdminAgentDetail | null>
  listFeedback(input: AdminFeedbackListQuery): Promise<AdminFeedbackList>
}
