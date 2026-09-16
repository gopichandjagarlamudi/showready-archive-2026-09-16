import type { LeadStage, Recommendation } from "@showready/contracts"
import { mobileTheme } from "./theme"

export function getStagePresentation(
  stage?: LeadStage,
  recommendation?: Recommendation
) {
  if (recommendation === "show" || stage === "ready_to_show") {
    return {
      label: "Ready to show",
      backgroundColor: mobileTheme.colors.readySoft,
      color: mobileTheme.colors.ready
    }
  }

  if (stage === "appointment_booked") {
    return {
      label: "Appointment booked",
      backgroundColor: mobileTheme.colors.appointmentSoft,
      color: mobileTheme.colors.appointment
    }
  }

  if (recommendation === "nurture" || stage === "nurture") {
    return {
      label: "Nurture",
      backgroundColor: mobileTheme.colors.nurtureSoft,
      color: mobileTheme.colors.nurture
    }
  }

  if (stage === "closed_won") {
    return {
      label: "Closed won",
      backgroundColor: mobileTheme.colors.wonSoft,
      color: mobileTheme.colors.won
    }
  }

  if (stage === "closed_lost") {
    return {
      label: "Closed lost",
      backgroundColor: mobileTheme.colors.lostSoft,
      color: mobileTheme.colors.lost
    }
  }

  if (stage === "archived") {
    return {
      label: "Archived",
      backgroundColor: mobileTheme.colors.holdSoft,
      color: mobileTheme.colors.mutedInk
    }
  }

  return {
    label: "Hold",
    backgroundColor: mobileTheme.colors.holdSoft,
    color: mobileTheme.colors.hold
  }
}
