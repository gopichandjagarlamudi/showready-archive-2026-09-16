import type { AppointmentStatus, LeadStage } from "@showready/contracts"

export type AppointmentTab = "upcoming" | "completed" | "cancelled"

export type AppointmentShowingInput = {
  address: string
  notes?: string
}

export function canCreateAppointmentForLead(stage: LeadStage) {
  return stage === "ready_to_show" || stage === "nurture" || stage === "hold"
}

export function getStatusForAppointmentTab(tab: AppointmentTab): AppointmentStatus {
  if (tab === "completed") {
    return "completed"
  }

  if (tab === "cancelled") {
    return "cancelled"
  }

  return "scheduled"
}

export function normalizeShowingsInput(showings: AppointmentShowingInput[]) {
  return showings
    .map((showing) => ({
      address: showing.address.trim(),
      notes: showing.notes?.trim() || undefined
    }))
    .filter((showing) => Boolean(showing.address))
    .map((showing, index) => ({
      ...showing,
      orderIndex: index
    }))
}
