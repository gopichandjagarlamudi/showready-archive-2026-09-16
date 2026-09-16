import type {
  AgentProfile,
  AgentSettings,
  Appointment,
  ContactMethod,
  CustomQuestion,
  IntakeDraft,
  Invite,
  Lead,
  LeadContactInteraction,
  QuestionTemplate,
  ScoreBreakdown,
  ScoreOverride,
  Showing
} from "@showready/contracts"
import { intakeTypeToIntent } from "@showready/domain"
import { getLeadReviewState } from "@showready/domain"

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

function normalizeIntakeType(value: string | null | undefined) {
  return value === "rental" ? "rental" : "sale"
}

function normalizeDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function mapEmailNotificationsEnabled(row: {
  email_notifications_enabled?: boolean | null
  notification_preference?: "email" | "email_and_push" | null
}) {
  if (typeof row.email_notifications_enabled === "boolean") {
    return row.email_notifications_enabled
  }

  return row.notification_preference === "email" || row.notification_preference === "email_and_push"
}

export function parseCustomQuestions(value: JsonValue): CustomQuestion[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value as unknown as CustomQuestion[]
}

export function parseBreakdown(value: JsonValue | null): ScoreBreakdown | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  return value as unknown as ScoreBreakdown
}

export function parseDraft(value: JsonValue | null): IntakeDraft | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  return value as unknown as IntakeDraft
}

export function buildAnswerMaps(
  rows: Array<{ question_key: string; answer_value: JsonValue }>,
  row?: {
    buyer_name?: string | null
    buyer_phone?: string | null
    buyer_email?: string | null
    intake_type?: string | null
  }
): {
  answers: IntakeDraft
  customAnswers: Record<string, string | string[]>
} {
  const answers: IntakeDraft = {
    contact: {
      fullName: row?.buyer_name ?? "",
      phone: row?.buyer_phone ?? undefined,
      email: row?.buyer_email ?? undefined
    },
    intent: row ? intakeTypeToIntent(normalizeIntakeType(row.intake_type)) : undefined,
    buyer: {},
    rental: {},
    customAnswers: {}
  }
  const customAnswers: Record<string, string | string[]> = answers.customAnswers ?? {}

  for (const answerRow of rows) {
    if (answerRow.question_key.startsWith("contact.")) {
      const key = answerRow.question_key.replace("contact.", "")
      ;(answers.contact as Record<string, JsonValue>)[key] = answerRow.answer_value
      continue
    }

    if (answerRow.question_key === "intent") {
      answers.intent = answerRow.answer_value as "buy" | "rent"
      continue
    }

    if (answerRow.question_key.startsWith("buyer.")) {
      const key = answerRow.question_key.replace("buyer.", "")
      ;(answers.buyer as Record<string, JsonValue>)[key] = answerRow.answer_value
      continue
    }

    if (answerRow.question_key.startsWith("rental.")) {
      const key = answerRow.question_key.replace("rental.", "")
      ;(answers.rental as Record<string, JsonValue>)[key] = answerRow.answer_value
      continue
    }

    if (answerRow.question_key.startsWith("custom.")) {
      customAnswers[answerRow.question_key.replace("custom.", "")] =
        answerRow.answer_value as string | string[]
    }
  }

  return {
    answers,
    customAnswers
  }
}

export function mapAgentProfile(row: {
  id: string
  email: string
  full_name: string
  brokerage?: string | null
  license_number?: string | null
  photo_url?: string | null
  logo_url?: string | null
  onboarded_at?: string | null
}): AgentProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    brokerage: row.brokerage ?? undefined,
    licenseNumber: row.license_number ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    onboardedAt: row.onboarded_at ?? undefined
  }
}

export function mapAgentSettings(row: {
  agent_id: string
  brand_name: string
  brand_color: string
  accent_color: string
  show_threshold: number
  email_notifications_enabled?: boolean | null
  notification_preference?: "email" | "email_and_push" | null
  question_template_id: string
}): AgentSettings {
  return {
    agentId: row.agent_id,
    brandName: row.brand_name,
    brandColor: row.brand_color,
    accentColor: row.accent_color,
    showThreshold: row.show_threshold,
    emailNotificationsEnabled: mapEmailNotificationsEnabled(row),
    questionTemplateId: row.question_template_id
  }
}

export function mapQuestionTemplate(row: {
  id: string
  intake_type: string | null
  name: string
  intro_headline: string
  intro_body: string
  custom_questions: JsonValue
}): QuestionTemplate {
  return {
    id: row.id,
    intakeType: normalizeIntakeType(row.intake_type),
    name: row.name,
    introHeadline: row.intro_headline,
    introBody: row.intro_body,
    customQuestions: parseCustomQuestions(row.custom_questions)
  }
}

export function mapLeadContactInteractionRecord(row: {
  id: string
  lead_id: string
  agent_id: string
  method: ContactMethod
  occurred_at: string
}): LeadContactInteraction {
  return {
    id: row.id,
    leadId: row.lead_id,
    agentId: row.agent_id,
    method: row.method,
    occurredAt: normalizeDateTime(row.occurred_at)
  }
}

export function mapLeadRecord(
  row: {
    id: string
    agent_id: string
    intake_type: string | null
    buyer_name: string
    buyer_phone?: string | null
    buyer_email?: string | null
    token: string
    token_expires_at: string
    status: Lead["status"]
    pipeline_stage: Lead["pipelineStage"]
    submitted_at?: string | null
    score?: number | null
    recommendation?: Lead["recommendation"] | null
    summary?: string | null
    created_at: string
    updated_at: string
    reviewed_at?: string | null
    reviewed_stage?: Lead["reviewedStage"] | null
  },
  answerRows: Array<{ question_key: string; answer_value: JsonValue }> = [],
  scoreRow?: {
    breakdown?: JsonValue | null
    overridden?: boolean
    override_meta?: JsonValue | null
  },
  contactInteractionRows: Array<{
    id: string
    lead_id: string
    agent_id: string
    method: ContactMethod
    occurred_at: string
  }> = []
): Lead {
  const { answers, customAnswers } = buildAnswerMaps(answerRows, row)
  const scoreOverride =
    scoreRow?.overridden && scoreRow.override_meta
      ? (scoreRow.override_meta as unknown as ScoreOverride)
      : undefined
  const review = getLeadReviewState({
    pipelineStage: row.pipeline_stage,
    recommendation: row.recommendation ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedStage: row.reviewed_stage ?? undefined
  })

  return {
    id: row.id,
    agentId: row.agent_id,
    intakeType: normalizeIntakeType(row.intake_type),
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone ?? undefined,
    buyerEmail: row.buyer_email ?? undefined,
    token: row.token,
    tokenExpiresAt: row.token_expires_at,
    status: row.status,
    pipelineStage: row.pipeline_stage,
    submittedAt: row.submitted_at ?? undefined,
    score: row.score ?? undefined,
    recommendation: row.recommendation ?? undefined,
    summary: row.summary ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedStage: row.reviewed_stage ?? undefined,
    answers,
    customAnswers,
    scoreBreakdown: parseBreakdown(scoreRow?.breakdown ?? null),
    scoreOverride,
    review,
    contactInteractions: contactInteractionRows.map((interactionRow) =>
      mapLeadContactInteractionRecord(interactionRow)
    )
  }
}

export function mapInviteRecord(row: {
  id: string
  agent_id: string
  token: string
  status: Invite["status"]
  token_expires_at: string
  created_at: string
  updated_at: string
  opened_at?: string | null
  converted_at?: string | null
  lead_id?: string | null
  draft_payload?: JsonValue | null
}): Invite {
  return {
    id: row.id,
    agentId: row.agent_id,
    token: row.token,
    status: row.status,
    tokenExpiresAt: row.token_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    openedAt: row.opened_at ?? undefined,
    convertedAt: row.converted_at ?? undefined,
    leadId: row.lead_id ?? undefined,
    draft: parseDraft(row.draft_payload ?? null) ?? {
      contact: { fullName: "" }
    }
  }
}

export function mapAppointmentLeadSummary(row: {
  id: string
  buyer_name: string
  buyer_phone?: string | null
  buyer_email?: string | null
  pipeline_stage: Lead["pipelineStage"]
}): Appointment["lead"] {
  return {
    id: row.id,
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone ?? undefined,
    buyerEmail: row.buyer_email ?? undefined,
    pipelineStage: row.pipeline_stage
  }
}

export function mapShowing(row: {
  id: string
  appointment_id: string
  address: string
  order_index: number
  notes?: string | null
}): Showing {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    address: row.address,
    orderIndex: row.order_index,
    notes: row.notes ?? undefined
  }
}

function normalizeTimeForContract(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/.exec(value)
  return match ? `${match[1]}:${match[2]}` : value
}

export function mapAppointment(
  row: {
    id: string
    lead_id: string
    date: string
    start_time: string
    status: Appointment["status"]
    notes?: string | null
    created_at: string
  },
  lead: {
    id: string
    buyer_name: string
    buyer_phone?: string | null
    buyer_email?: string | null
    pipeline_stage: Lead["pipelineStage"]
  },
  showingRows: Array<{
    id: string
    appointment_id: string
    address: string
    order_index: number
    notes?: string | null
  }>
): Appointment {
  return {
    id: row.id,
    leadId: row.lead_id,
    date: row.date,
    startTime: normalizeTimeForContract(row.start_time),
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    lead: mapAppointmentLeadSummary(lead),
    showings: showingRows
      .slice()
      .sort((left, right) => left.order_index - right.order_index)
      .map((showing) => mapShowing(showing))
  }
}
