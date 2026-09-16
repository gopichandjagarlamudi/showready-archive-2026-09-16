import type {
  LeadContactInteraction,
  Lead,
  PipelineCategory,
  PipelineLead,
  PipelineTab
} from "@showready/contracts"

export type ScheduledAppointmentSummary = {
  date: string
  startTime: string
}

const ACTIVE_DISPLAY_STAGES = new Set(["ready_to_show", "nurture", "hold"])
const RESOLVED_STAGES = new Set(["closed_won", "closed_lost", "archived"])
const CONTACT_BOOST_WINDOW_MS = 72 * 60 * 60 * 1000

function toTimestamp(value?: string) {
  return value ? new Date(value).getTime() : 0
}

function compareRecent(left: PipelineLead, right: PipelineLead) {
  return toTimestamp(right.lastMovementAt ?? right.updatedAt) - toTimestamp(left.lastMovementAt ?? left.updatedAt)
}

function compareScoreThenRecent(left: PipelineLead, right: PipelineLead) {
  const scoreDelta = (right.score ?? 0) - (left.score ?? 0)
  return scoreDelta !== 0 ? scoreDelta : compareRecent(left, right)
}

function compareAppointment(
  appointmentsByLeadId: Map<string, ScheduledAppointmentSummary>
) {
  return (left: PipelineLead, right: PipelineLead) => {
    const leftAppointment = appointmentsByLeadId.get(left.id)
    const rightAppointment = appointmentsByLeadId.get(right.id)
    const leftValue = `${leftAppointment?.date ?? ""}T${leftAppointment?.startTime ?? ""}`
    const rightValue = `${rightAppointment?.date ?? ""}T${rightAppointment?.startTime ?? ""}`

    return leftValue.localeCompare(rightValue)
  }
}

function compareContactRecent(left: PipelineLead, right: PipelineLead) {
  return (
    toTimestamp(right.latestContactInteraction?.occurredAt) -
    toTimestamp(left.latestContactInteraction?.occurredAt)
  )
}

function daysSince(value: string | undefined, now: Date) {
  if (!value) {
    return 0
  }

  return (now.getTime() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)
}

export function isRecentlyContacted(
  interaction: Pick<LeadContactInteraction, "occurredAt"> | undefined,
  now: Date
) {
  if (!interaction?.occurredAt) {
    return false
  }

  const ageMs = now.getTime() - new Date(interaction.occurredAt).getTime()
  return ageMs <= CONTACT_BOOST_WINDOW_MS
}

function formatContactMethod(method: LeadContactInteraction["method"]) {
  return method === "call" ? "call" : method === "text" ? "text" : "email"
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function formatContactAttentionReason(
  interaction: Pick<LeadContactInteraction, "method" | "occurredAt">,
  now = new Date()
) {
  const occurredAt = new Date(interaction.occurredAt)
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(occurredAt)
  const dateLabel = isSameLocalDay(occurredAt, now)
    ? "today"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric"
      }).format(occurredAt)

  return `Attempted ${formatContactMethod(interaction.method)} ${dateLabel} at ${timeLabel}.`
}

export function getPipelineDisplayStage(lead: Pick<PipelineLead, "pipelineStage" | "reviewedStage" | "recommendation" | "review">): PipelineCategory | null {
  if (
    lead.pipelineStage === "ready_to_show" ||
    lead.pipelineStage === "nurture" ||
    lead.pipelineStage === "hold" ||
    lead.pipelineStage === "closed_won" ||
    lead.pipelineStage === "closed_lost" ||
    lead.pipelineStage === "archived"
  ) {
    return lead.pipelineStage
  }

  if (lead.pipelineStage !== "appointment_booked") {
    return null
  }

  if (
    lead.reviewedStage === "ready_to_show" ||
    lead.reviewedStage === "nurture" ||
    lead.reviewedStage === "hold"
  ) {
    return lead.reviewedStage
  }

  if (
    lead.review?.reviewedStage === "ready_to_show" ||
    lead.review?.reviewedStage === "nurture" ||
    lead.review?.reviewedStage === "hold"
  ) {
    return lead.review.reviewedStage
  }

  if (
    lead.review?.suggestedStage === "ready_to_show" ||
    lead.review?.suggestedStage === "nurture" ||
    lead.review?.suggestedStage === "hold"
  ) {
    return lead.review.suggestedStage
  }

  if (lead.recommendation === "show") {
    return "ready_to_show"
  }

  if (lead.recommendation === "nurture") {
    return "nurture"
  }

  return "hold"
}

export function getLastMovementAt(lead: Pick<PipelineLead, "reviewedAt" | "updatedAt" | "submittedAt" | "createdAt">) {
  return lead.reviewedAt ?? lead.updatedAt ?? lead.submittedAt ?? lead.createdAt
}

export function toPipelineLead(
  lead: Lead,
  attentionReason?: string,
  latestContactInteraction?: LeadContactInteraction
): PipelineLead {
  return {
    id: lead.id,
    agentId: lead.agentId,
    intakeType: lead.intakeType,
    buyerName: lead.buyerName,
    buyerPhone: lead.buyerPhone,
    buyerEmail: lead.buyerEmail,
    status: lead.status,
    pipelineStage: lead.pipelineStage,
    submittedAt: lead.submittedAt,
    score: lead.score,
    recommendation: lead.recommendation,
    summary: lead.summary,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    reviewedAt: lead.reviewedAt,
    reviewedStage: lead.reviewedStage,
    review: lead.review,
    lastMovementAt: getLastMovementAt(lead),
    attentionReason,
    latestContactInteraction
  }
}

export function isLeadInTab(lead: PipelineLead, tab: PipelineTab) {
  const displayStage = getPipelineDisplayStage(lead)

  if (!displayStage) {
    return false
  }

  return tab === "active"
    ? ACTIVE_DISPLAY_STAGES.has(displayStage)
    : RESOLVED_STAGES.has(displayStage)
}

export function isLeadInCategory(lead: PipelineLead, category: PipelineCategory) {
  if (category === "all") {
    return true
  }

  if (category === "buy") {
    return lead.intakeType === "sale"
  }

  if (category === "rent") {
    return lead.intakeType === "rental"
  }

  return getPipelineDisplayStage(lead) === category
}

export function isStaleForFocus(
  lead: PipelineLead,
  now: Date,
  hasScheduledAppointment: boolean
) {
  const displayStage = getPipelineDisplayStage(lead)
  const ageInDays = daysSince(lead.lastMovementAt ?? getLastMovementAt(lead), now)

  if (displayStage === "hold") {
    return ageInDays > 60
  }

  if (displayStage === "nurture") {
    return ageInDays > 90 && (lead.score ?? 0) < 7
  }

  if (displayStage === "ready_to_show") {
    return ageInDays > 45 && !hasScheduledAppointment
  }

  return false
}

export function buildFocusQueue(
  leads: PipelineLead[],
  appointmentsByLeadId: Map<string, ScheduledAppointmentSummary>,
  latestContactInteractionsByLeadId: Map<string, LeadContactInteraction> = new Map(),
  now = new Date(),
  limit = 25
) {
  const appointmentLeads: PipelineLead[] = []
  const contactedLeads: PipelineLead[] = []
  const readyLeads: PipelineLead[] = []
  const highNurtureLeads: PipelineLead[] = []
  const recentReviewedLeads: PipelineLead[] = []
  const holdLeads: PipelineLead[] = []

  for (const inputLead of leads) {
    const lead = {
      ...inputLead,
      lastMovementAt: inputLead.lastMovementAt ?? getLastMovementAt(inputLead)
    }
    const displayStage = getPipelineDisplayStage(lead)
    const appointment = appointmentsByLeadId.get(lead.id)
    const latestContactInteraction =
      latestContactInteractionsByLeadId.get(lead.id) ?? lead.latestContactInteraction
    const hasScheduledAppointment = Boolean(appointment)
    const hasRecentContact = isRecentlyContacted(latestContactInteraction, now)

    if (!displayStage || !ACTIVE_DISPLAY_STAGES.has(displayStage)) {
      continue
    }

    if (isStaleForFocus(lead, now, hasScheduledAppointment) && !hasRecentContact) {
      continue
    }

    if (appointment) {
      appointmentLeads.push({
        ...lead,
        attentionReason: `Showing scheduled ${appointment.date} at ${appointment.startTime}.`
      })
      continue
    }

    if (hasRecentContact && latestContactInteraction) {
      contactedLeads.push({
        ...lead,
        latestContactInteraction,
        attentionReason: formatContactAttentionReason(latestContactInteraction, now)
      })
      continue
    }

    if (displayStage === "ready_to_show") {
      readyLeads.push({
        ...lead,
        attentionReason: "Ready to show with no appointment scheduled."
      })
      continue
    }

    if (displayStage === "nurture" && (lead.score ?? 0) >= 7) {
      highNurtureLeads.push({
        ...lead,
        attentionReason: "Nurture lead has strong score or urgency signals."
      })
      continue
    }

    if (lead.reviewedAt || lead.review?.isReviewed) {
      recentReviewedLeads.push({
        ...lead,
        attentionReason: "Recently reviewed active lead."
      })
      continue
    }

    if (displayStage === "hold") {
      holdLeads.push({
        ...lead,
        attentionReason: "Hold lead is still within the active review window."
      })
    }
  }

  const ranked = [
    ...appointmentLeads.sort(compareAppointment(appointmentsByLeadId)),
    ...contactedLeads.sort(compareContactRecent),
    ...readyLeads.sort(compareScoreThenRecent),
    ...highNurtureLeads.sort(compareScoreThenRecent),
    ...recentReviewedLeads.sort(compareRecent),
    ...holdLeads.sort(compareRecent)
  ]
  const seenLeadIds = new Set<string>()
  const uniqueRanked: PipelineLead[] = []

  for (const lead of ranked) {
    if (seenLeadIds.has(lead.id)) {
      continue
    }

    seenLeadIds.add(lead.id)
    uniqueRanked.push(lead)
  }

  return uniqueRanked.slice(0, limit)
}

export function prioritizeActivePipelineLeads(
  leads: PipelineLead[],
  appointmentsByLeadId: Map<string, ScheduledAppointmentSummary>,
  latestContactInteractionsByLeadId: Map<string, LeadContactInteraction>,
  now = new Date()
) {
  const appointmentLeads: PipelineLead[] = []
  const contactedLeads: PipelineLead[] = []
  const regularLeads: PipelineLead[] = []

  for (const lead of leads) {
    const appointment = appointmentsByLeadId.get(lead.id)
    const latestContactInteraction =
      latestContactInteractionsByLeadId.get(lead.id) ?? lead.latestContactInteraction

    if (appointment) {
      appointmentLeads.push({
        ...lead,
        latestContactInteraction,
        attentionReason: `Showing scheduled ${appointment.date} at ${appointment.startTime}.`
      })
      continue
    }

    if (isRecentlyContacted(latestContactInteraction, now) && latestContactInteraction) {
      contactedLeads.push({
        ...lead,
        latestContactInteraction,
        attentionReason: formatContactAttentionReason(latestContactInteraction, now)
      })
      continue
    }

    regularLeads.push(lead)
  }

  return [
    ...appointmentLeads.sort(compareAppointment(appointmentsByLeadId)),
    ...contactedLeads.sort(compareContactRecent),
    ...regularLeads
  ]
}
