import "server-only"

import { randomUUID } from "node:crypto"
import { unstable_cache } from "next/cache"
import type { User, SupabaseClient } from "@supabase/supabase-js"
import type {
  AgentSettings,
  AppointmentListQuery,
  AppointmentListResponse,
  AppointmentStatus,
  AuditEvent,
  ContactMethod,
  ConsentRecord,
  CustomQuestion,
  DashboardSummary,
  IntakeDraft,
  IntakeSubmission,
  IntakeType,
  Lead,
  LeadContactInteraction,
  LeadListQuery,
  LeadListResponse,
  LeadMutation,
  LeadStage,
  PipelineLead,
  PipelineLeadListQuery,
  PipelineLeadListResponse,
  ProductEvent,
  QuestionTemplate,
  Recommendation,
  ScoreBreakdown,
  ScoreOverride
} from "@showready/contracts"
import {
  assertDraftSubmissionComplete,
  buildLeadInputFromDraft,
  canCreateAppointmentForLead,
  flattenDraftAnswers,
  getDefaultTemplateForIntakeType,
  getOptionalQuestionsForIntent,
  getRequiredQuestionsForIntent,
  getSuggestedStage,
  intakeTypeToIntent,
  intentToIntakeType,
  normalizeShowingsInput,
  resolveTemplateForIntakeType,
  scoreLead
} from "@showready/domain"
import type { DiagnosticsEvent } from "@showready/contracts"
import {
  mapAgentProfile,
  mapAgentSettings,
  mapAppointment,
  mapInviteRecord,
  mapLeadContactInteractionRecord,
  mapLeadRecord,
  mapQuestionTemplate
} from "@showready/infrastructure"
import {
  buildPublicIntakeBranding,
  type PublicIntakeBranding
} from "../public-intake-branding"
import { createSupabaseAdminClient } from "./admin"
import {
  buildFocusQueue,
  getPipelineDisplayStage,
  isLeadInCategory,
  isLeadInTab,
  prioritizeActivePipelineLeads,
  toPipelineLead,
  type ScheduledAppointmentSummary
} from "./pipeline"

type AppSupabaseClient = SupabaseClient<any>

const PIPELINE_ACTIVE_STAGES = ["ready_to_show", "appointment_booked", "nurture", "hold"]
const PIPELINE_RESOLVED_STAGES = ["closed_won", "closed_lost", "archived"]
const APPOINTMENT_ELIGIBLE_STAGES = ["ready_to_show", "nurture", "hold"]
const SEARCHABLE_RECOMMENDATIONS: Recommendation[] = ["show", "nurture", "hold"]
const LEAD_LIST_COLUMNS =
  "id, agent_id, intake_type, buyer_name, buyer_phone, buyer_email, token, token_expires_at, status, pipeline_stage, submitted_at, score, recommendation, summary, created_at, updated_at, reviewed_at, reviewed_stage"
const APPOINTMENT_LIST_COLUMNS =
  "id, lead_id, date, start_time, status, notes, created_at, leads!inner(id, buyer_name, buyer_phone, buyer_email, pipeline_stage)"
const LEAD_CONTACT_INTERACTION_COLUMNS = "id, lead_id, agent_id, method, occurred_at"

type OnboardingInput = {
  intakeType: IntakeType
  fullName: string
  brokerage?: string
  licenseNumber?: string
  brandName: string
  brandColor: string
  accentColor: string
  showThreshold: number
  emailNotificationsEnabled: AgentSettings["emailNotificationsEnabled"]
  introHeadline: string
  introBody: string
  customQuestions: CustomQuestion[]
}

type SubmitInviteInput = {
  draft: IntakeDraft
}

export type OutboxJobType =
  | "intake.submitted.product_event"
  | "intake.submitted.push_notifications"
  | "intake.submitted.email"
  | "intake.submitted.analytics"

type OutboxJobInput = {
  jobType: OutboxJobType
  resourceType: "lead"
  resourceId: string
  payload: Record<string, unknown>
}

export type OutboxJob = {
  id: string
  agentId: string
  jobType: OutboxJobType
  resourceType: string
  resourceId: string
  payload: Record<string, unknown>
  status: "pending" | "processing" | "failed" | "completed" | "dead"
  attemptCount: number
  maxAttempts: number
}

export type RetentionCleanupResult = {
  targetTable: string
  deletedCount: number
}

export type PublicFormConfig = {
  branding: PublicIntakeBranding
  settings?: Pick<AgentSettings, "brandName" | "brandColor" | "accentColor">
  templates: {
    sale: QuestionTemplate
    rental: QuestionTemplate
  }
}

type PublicFormConfigLoader = (agentId: string) => Promise<PublicFormConfig>

function nowIso() {
  return new Date().toISOString()
}

function mapOutboxJob(row: any): OutboxJob {
  return {
    id: row.id,
    agentId: row.agent_id,
    jobType: row.job_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    payload: row.payload ?? {},
    status: row.status,
    attemptCount: row.attempt_count ?? 0,
    maxAttempts: row.max_attempts ?? 5
  }
}

function requireData<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw new Error(message)
  }

  return value
}

function getDisplayName(user: User) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const fromMetadata =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null

  return fromMetadata ?? user.email?.split("@")[0] ?? "ShowReady Agent"
}

function assertLeadIntakeMutable(status: string) {
  if (status === "submitted") {
    throw new Error("This intake has already been submitted.")
  }
}

function recommendationForScore(
  score: number,
  showThreshold: number
): Recommendation {
  if (score >= showThreshold) {
    return "show"
  }

  if (score >= 5) {
    return "nurture"
  }

  return "hold"
}

function defaultSettings(agentId: string, templateId: string) {
  return {
    agent_id: agentId,
    brand_name: "ShowReady",
    brand_color: "#1F5F57",
    accent_color: "#B74D2C",
    show_threshold: 8,
    email_notifications_enabled: false,
    question_template_id: templateId
  }
}

function isMissingColumnError(error: unknown, columnName: string) {
  const candidate = error as { code?: string; message?: string } | null

  return (
    (candidate?.code === "PGRST204" || candidate?.code === "42703") &&
    Boolean(candidate.message?.includes(columnName))
  )
}

function toLegacyAgentSettingsPayload<T extends { email_notifications_enabled?: boolean | null }>(
  payload: T
) {
  const { email_notifications_enabled: _emailNotificationsEnabled, ...legacyPayload } = payload

  return {
    ...legacyPayload,
    notification_preference: "email"
  }
}

async function insertAgentSettings(
  client: AppSupabaseClient,
  payload: ReturnType<typeof defaultSettings> & { id: string }
) {
  const result = await client.from("agent_settings").insert(payload)

  if (!result.error || !isMissingColumnError(result.error, "email_notifications_enabled")) {
    return result
  }

  return client.from("agent_settings").insert(toLegacyAgentSettingsPayload(payload))
}

async function updateAgentSettings(
  client: AppSupabaseClient,
  agentId: string,
  payload: {
    brand_name: string
    brand_color: string
    accent_color: string
    show_threshold: number
    email_notifications_enabled: boolean
  }
) {
  const result = await client.from("agent_settings").update(payload).eq("agent_id", agentId)

  if (!result.error || !isMissingColumnError(result.error, "email_notifications_enabled")) {
    return result
  }

  return client
    .from("agent_settings")
    .update(toLegacyAgentSettingsPayload(payload))
    .eq("agent_id", agentId)
}

export async function ensureAgentScaffold(
  adminClient: AppSupabaseClient,
  user: User
) {
  const { data: existingAgent } = await adminClient
    .from("agents")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  if (existingAgent) {
    return
  }

  const fullName = getDisplayName(user)
  const { error: agentError } = await adminClient.from("agents").upsert(
    {
      id: user.id,
      email: user.email ?? `${user.id}@showready.local`,
      full_name: fullName
    },
    {
      onConflict: "id"
    }
  )

  if (agentError) {
    throw agentError
  }

  const templates = (["sale", "rental"] as const).map((intakeType) => {
    const template = getDefaultTemplateForIntakeType(intakeType)

    return {
      id: randomUUID(),
      agent_id: user.id,
      intake_type: intakeType,
      name: template.name,
      intro_headline: template.introHeadline,
      intro_body: template.introBody,
      custom_questions: template.customQuestions
    }
  })

  const saleTemplateId =
    templates.find((entry) => entry.intake_type === "sale")?.id ?? randomUUID()

  const { error: templateError } = await adminClient
    .from("question_templates")
    .upsert(templates, {
      onConflict: "agent_id,intake_type"
    })

  if (templateError) {
    throw templateError
  }

  const { error: settingsError } = await insertAgentSettings(adminClient, {
    id: randomUUID(),
    ...defaultSettings(user.id, saleTemplateId)
  })

  if (settingsError && settingsError.code !== "23505") {
    throw settingsError
  }
}

export async function getAgentContext(
  client: AppSupabaseClient,
  agentId: string
) {
  const [{ data: agent, error: agentError }, { data: settings, error: settingsError }] =
    await Promise.all([
      client.from("agents").select("*").eq("id", agentId).maybeSingle(),
      client.from("agent_settings").select("*").eq("agent_id", agentId).maybeSingle()
    ])

  if (agentError) {
    throw agentError
  }

  if (settingsError) {
    throw settingsError
  }

  if (!agent || !settings) {
    return null
  }

  const { data: templates, error: templateError } = await client
    .from("question_templates")
    .select("*")
    .eq("agent_id", agentId)

  if (templateError) {
    throw templateError
  }

  if (!templates || templates.length === 0) {
    return null
  }

  const mappedTemplates = templates.map((entry: any) => mapQuestionTemplate(entry))
  const selectedTemplate =
    mappedTemplates.find((entry) => entry.id === settings.question_template_id) ??
    resolveTemplateForIntakeType("sale", mappedTemplates)

  return {
    agent: mapAgentProfile(agent),
    settings: mapAgentSettings(settings),
    template: selectedTemplate,
    templates: mappedTemplates
  }
}

export async function listAgentPushTokens(
  client: AppSupabaseClient,
  agentId: string
) {
  const { data, error } = await client
    .from("agent_device_tokens")
    .select("expo_push_token")
    .eq("agent_id", agentId)

  if (error) {
    throw error
  }

  return (data ?? [])
    .map((row: { expo_push_token?: string | null }) => row.expo_push_token ?? null)
    .filter((token): token is string => Boolean(token))
}

export async function registerAgentPushToken(
  client: AppSupabaseClient,
  agentId: string,
  input: {
    expoPushToken: string
    platform: "ios" | "android" | "unknown"
  }
) {
  const { error } = await client.from("agent_device_tokens").upsert(
    {
      agent_id: agentId,
      expo_push_token: input.expoPushToken,
      platform: input.platform,
      last_seen_at: nowIso(),
      updated_at: nowIso()
    },
    {
      onConflict: "agent_id,expo_push_token"
    }
  )

  if (error) {
    throw error
  }

  return { ok: true as const }
}

export async function enqueueOutboxJobs(
  client: AppSupabaseClient,
  agentId: string,
  jobs: OutboxJobInput[]
) {
  if (jobs.length === 0) {
    return []
  }

  const rows = jobs.map((job) => ({
    id: randomUUID(),
    dedupe_key: `${agentId}:${job.jobType}:${job.resourceType}:${job.resourceId}`,
    agent_id: agentId,
    job_type: job.jobType,
    resource_type: job.resourceType,
    resource_id: job.resourceId,
    payload: job.payload,
    status: "pending",
    available_at: nowIso(),
    updated_at: nowIso()
  }))

  const { data, error } = await client
    .from("outbox_jobs")
    .upsert(rows, {
      onConflict: "dedupe_key",
      ignoreDuplicates: true
    })
    .select("*")

  if (error) {
    throw error
  }

  return (data ?? []).map((row: any) => mapOutboxJob(row))
}

export async function claimOutboxJobs(client: AppSupabaseClient, limit = 10) {
  const { data, error } = await client.rpc("claim_outbox_jobs", {
    p_limit: Math.max(1, Math.min(limit, 25))
  })

  if (error) {
    throw error
  }

  return (data ?? []).map((row: any) => mapOutboxJob(row))
}

export async function claimRelatedPushNotificationJobs(
  client: AppSupabaseClient,
  agentId: string,
  excludedJobIds: string[],
  limit = 50
) {
  if (limit <= 0) {
    return []
  }

  const { data, error } = await client.rpc("claim_agent_push_notification_jobs", {
    p_agent_id: agentId,
    p_excluded_job_ids: excludedJobIds,
    p_limit: Math.max(1, Math.min(limit, 50))
  })

  if (error) {
    throw error
  }

  return (data ?? []).map((row: any) => mapOutboxJob(row))
}

export async function completeOutboxJob(client: AppSupabaseClient, jobId: string) {
  const { error } = await client
    .from("outbox_jobs")
    .update({
      status: "completed",
      completed_at: nowIso(),
      updated_at: nowIso()
    })
    .eq("id", jobId)

  if (error) {
    throw error
  }
}

export async function failOutboxJob(
  client: AppSupabaseClient,
  job: OutboxJob,
  errorMessage: string
) {
  const shouldStopRetrying = job.attemptCount >= job.maxAttempts
  const retryDelayMs = Math.min(job.attemptCount * 60_000, 10 * 60_000)

  const { error } = await client
    .from("outbox_jobs")
    .update({
      status: shouldStopRetrying ? "dead" : "failed",
      last_error: errorMessage.slice(0, 2000),
      available_at: shouldStopRetrying
        ? null
        : new Date(Date.now() + retryDelayMs).toISOString(),
      updated_at: nowIso()
    })
    .eq("id", job.id)

  if (error) {
    throw error
  }
}

export async function runRetentionCleanup(
  client: AppSupabaseClient
): Promise<RetentionCleanupResult[]> {
  const { data, error } = await client.rpc("cleanup_showready_retention")

  if (error) {
    throw error
  }

  return (data ?? []).map((row: any) => ({
    targetTable: row.target_table,
    deletedCount: Number(row.deleted_count ?? 0)
  }))
}

export async function getAgentProfile(client: AppSupabaseClient, agentId: string) {
  const { data, error } = await client
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapAgentProfile(data) : null
}

export async function listLeads(
  client: AppSupabaseClient,
  agentId: string,
  input: LeadListQuery = {
    scope: "all",
    limit: 25,
    offset: 0
  }
): Promise<LeadListResponse> {
  let queryBuilder = client
    .from("leads")
    .select(LEAD_LIST_COLUMNS, { count: "exact" })
    .eq("agent_id", agentId)

  if (input.scope === "new") {
    queryBuilder = queryBuilder
      .eq("status", "submitted")
      .eq("pipeline_stage", "new")
      .order("submitted_at", { ascending: false })
  } else if (input.scope === "appointment_eligible") {
    queryBuilder = queryBuilder
      .in("pipeline_stage", APPOINTMENT_ELIGIBLE_STAGES)
      .order("updated_at", { ascending: false })
  } else {
    queryBuilder = queryBuilder.order("updated_at", { ascending: false })
  }

  queryBuilder = applySearchFilter(queryBuilder, input.query).range(
    input.offset,
    input.offset + input.limit
  )

  const { data, error, count } = await queryBuilder

  if (error) {
    throw error
  }

  const fetchedRows = data ?? []
  const hasMore = fetchedRows.length > input.limit
  const leads = fetchedRows.slice(0, input.limit).map((row: any) => mapLeadRecord(row))
  const total = Math.max(
    count ?? 0,
    input.offset + leads.length + (hasMore ? 1 : 0)
  )

  return {
    leads,
    total,
    nextOffset: hasMore ? input.offset + leads.length : undefined
  }
}

function contactAnswerRows(leadId: string, input: LeadMutation) {
  const timestamp = nowIso()
  const rows = [
    {
      lead_id: leadId,
      question_key: "contact.fullName",
      answer_value: input.buyerName.trim(),
      scored: false,
      updated_at: timestamp
    }
  ]

  if (input.buyerEmail?.trim()) {
    rows.push({
      lead_id: leadId,
      question_key: "contact.email",
      answer_value: input.buyerEmail.trim(),
      scored: false,
      updated_at: timestamp
    })
  }

  if (input.buyerPhone?.trim()) {
    rows.push({
      lead_id: leadId,
      question_key: "contact.phone",
      answer_value: input.buyerPhone.trim(),
      scored: false,
      updated_at: timestamp
    })
  }

  return rows
}

async function replaceLeadContactAnswers(
  client: AppSupabaseClient,
  leadId: string,
  input: LeadMutation
) {
  const contactQuestionKeys = ["contact.fullName", "contact.email", "contact.phone"]
  const { error: deleteError } = await client
    .from("lead_answers")
    .delete()
    .eq("lead_id", leadId)
    .in("question_key", contactQuestionKeys)

  if (deleteError) {
    throw deleteError
  }

  const rows = contactAnswerRows(leadId, input)
  const { error: insertError } = await client.from("lead_answers").insert(rows)

  if (insertError) {
    throw insertError
  }
}

async function loadLeadAnswerRows(client: AppSupabaseClient, leadId: string) {
  const { data, error } = await client
    .from("lead_answers")
    .select("*")
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function createManualLead(
  client: AppSupabaseClient,
  agentId: string,
  input: LeadMutation
) {
  const timestamp = nowIso()
  const { data, error } = await client
    .from("leads")
    .insert({
      id: randomUUID(),
      agent_id: agentId,
      intake_type: input.intakeType,
      buyer_name: input.buyerName.trim(),
      buyer_email: input.buyerEmail?.trim() || null,
      buyer_phone: input.buyerPhone?.trim() || null,
      token: randomUUID(),
      token_expires_at: addDays(new Date(), 7).toISOString(),
      status: "submitted",
      pipeline_stage: "new",
      submitted_at: timestamp,
      summary: "Manual lead created from mobile.",
      created_at: timestamp,
      updated_at: timestamp
    })
    .select(LEAD_LIST_COLUMNS)
    .single()

  if (error) {
    throw error
  }

  await replaceLeadContactAnswers(client, data.id, input)
  const answerRows = await loadLeadAnswerRows(client, data.id)

  return mapLeadRecord(data, answerRows)
}

export async function updateLeadContact(
  client: AppSupabaseClient,
  agentId: string,
  leadId: string,
  input: LeadMutation
) {
  const { data, error } = await client
    .from("leads")
    .update({
      intake_type: input.intakeType,
      buyer_name: input.buyerName.trim(),
      buyer_email: input.buyerEmail?.trim() || null,
      buyer_phone: input.buyerPhone?.trim() || null,
      updated_at: nowIso()
    })
    .eq("agent_id", agentId)
    .eq("id", leadId)
    .select(LEAD_LIST_COLUMNS)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  await replaceLeadContactAnswers(client, leadId, input)
  const answerRows = await loadLeadAnswerRows(client, leadId)

  return mapLeadRecord(data, answerRows)
}

async function deleteRowsByLeadId(
  client: AppSupabaseClient,
  table: string,
  leadId: string,
  agentId?: string
) {
  let query = client.from(table).delete().eq("lead_id", leadId)

  if (agentId) {
    query = query.eq("agent_id", agentId)
  }

  const { error } = await query

  if (error) {
    if (table === "lead_contact_interactions" && isMissingRelationError(error, table)) {
      return
    }

    throw error
  }
}

export async function deleteLead(
  client: AppSupabaseClient,
  agentId: string,
  leadId: string
) {
  const { data: lead, error: lookupError } = await client
    .from("leads")
    .select("id")
    .eq("agent_id", agentId)
    .eq("id", leadId)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (!lead) {
    return false
  }

  const { data: appointments, error: appointmentsError } = await client
    .from("appointments")
    .select("id")
    .eq("lead_id", leadId)

  if (appointmentsError) {
    throw appointmentsError
  }

  const appointmentIds = (appointments ?? []).map((row: { id: string }) => row.id)

  if (appointmentIds.length > 0) {
    const { error: showingsError } = await client
      .from("showings")
      .delete()
      .in("appointment_id", appointmentIds)

    if (showingsError) {
      throw showingsError
    }
  }

  await deleteRowsByLeadId(client, "appointments", leadId)
  await deleteRowsByLeadId(client, "lead_contact_interactions", leadId, agentId)
  await deleteRowsByLeadId(client, "lead_scores", leadId)
  await deleteRowsByLeadId(client, "lead_answers", leadId)
  await deleteRowsByLeadId(client, "invites", leadId)

  const { error: deleteError } = await client
    .from("leads")
    .delete()
    .eq("agent_id", agentId)
    .eq("id", leadId)

  if (deleteError) {
    throw deleteError
  }

  return true
}

export async function listSubmittedLeadsForCsvExport(
  client: AppSupabaseClient,
  agentId: string,
  input: {
    submittedFrom: string
    submittedTo: string
    limit?: number
  }
): Promise<Lead[]> {
  const rowLimit = Math.max(1, Math.min(input.limit ?? 10_000, 10_000))
  const { data, error } = await client
    .from("leads")
    .select(LEAD_LIST_COLUMNS)
    .eq("agent_id", agentId)
    .eq("status", "submitted")
    .gte("submitted_at", input.submittedFrom)
    .lte("submitted_at", input.submittedTo)
    .order("submitted_at", { ascending: false })
    .limit(rowLimit + 1)

  if (error) {
    throw error
  }

  const leadRows = data ?? []

  if (leadRows.length > rowLimit) {
    throw new Error("Export contains too many leads. Choose a shorter date range.")
  }

  if (leadRows.length === 0) {
    return []
  }

  const leadIds = leadRows.map((row: any) => row.id)
  const { data: answerRows, error: answerError } = await client
    .from("lead_answers")
    .select("lead_id, question_key, answer_value")
    .in("lead_id", leadIds)
    .order("updated_at", { ascending: true })

  if (answerError) {
    throw answerError
  }

  const answersByLeadId = new Map<string, Array<{ question_key: string; answer_value: any }>>()

  for (const answerRow of answerRows ?? []) {
    const existingRows = answersByLeadId.get(answerRow.lead_id) ?? []
    existingRows.push({
      question_key: answerRow.question_key,
      answer_value: answerRow.answer_value
    })
    answersByLeadId.set(answerRow.lead_id, existingRows)
  }

  return leadRows.map((row: any) => mapLeadRecord(row, answersByLeadId.get(row.id) ?? []))
}

export async function listRecentLeads(client: AppSupabaseClient, agentId: string, limit = 4) {
  const rowLimit = Math.max(1, Math.min(limit, 10))
  const { data, error } = await client
    .from("leads")
    .select(LEAD_LIST_COLUMNS)
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false })
    .limit(rowLimit)

  if (error) {
    throw error
  }

  return (data ?? []).map((row: any) => mapLeadRecord(row))
}

export async function listAppointmentEligibleLeadSuggestions(
  client: AppSupabaseClient,
  agentId: string,
  limit = 3,
  query?: string
) {
  const rowLimit = Math.max(1, Math.min(limit, 10))
  let queryBuilder = client
    .from("leads")
    .select(LEAD_LIST_COLUMNS)
    .eq("agent_id", agentId)
    .in("pipeline_stage", APPOINTMENT_ELIGIBLE_STAGES)

  queryBuilder = applySearchFilter(queryBuilder, query)

  const { data, error } = await queryBuilder
    .order("updated_at", { ascending: false })
    .limit(rowLimit)

  if (error) {
    throw error
  }

  return (data ?? []).map((row: any) => mapLeadRecord(row))
}

export async function listNewLeadsForReview(client: AppSupabaseClient, agentId: string) {
  const page = await listLeads(client, agentId, {
    scope: "new",
    limit: 25,
    offset: 0
  })

  return page.leads
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatSubmittedDateLabel(value?: string) {
  if (!value) {
    return undefined
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value))
}

function formatApiDate(value: Date) {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, "0")
  const day = String(value.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function activeStagesForQuery(tab: PipelineLeadListQuery["tab"]) {
  return tab === "active" ? PIPELINE_ACTIVE_STAGES : PIPELINE_RESOLVED_STAGES
}

function pipelineStagesForQuery(
  tab: PipelineLeadListQuery["tab"],
  category: PipelineLeadListQuery["category"]
) {
  if (category === "all") {
    return activeStagesForQuery(tab)
  }

  if (category === "buy" || category === "rent") {
    return activeStagesForQuery(tab)
  }

  if (tab === "active") {
    return category === "ready_to_show" || category === "nurture" || category === "hold"
      ? [category, "appointment_booked"]
      : []
  }

  return category === "closed_won" || category === "closed_lost" || category === "archived"
    ? [category]
    : []
}

function applyPipelineIntakeTypeFilter(
  queryBuilder: any,
  category: PipelineLeadListQuery["category"]
) {
  if (category === "buy") {
    return queryBuilder.or("intake_type.eq.sale,intake_type.is.null")
  }

  if (category === "rent") {
    return queryBuilder.eq("intake_type", "rental")
  }

  return queryBuilder
}

function makeSummaryLabel(input: {
  mode: PipelineLeadListResponse["mode"]
  total: number
  visibleCount: number
  submittedFrom?: string
  tab: PipelineLeadListQuery["tab"]
}) {
  const submittedLabel = formatSubmittedDateLabel(input.submittedFrom)

  if (submittedLabel) {
    return `Submitted ${submittedLabel} · ${formatCount(input.total)} shown`
  }

  if (input.mode === "focus_queue") {
    return `Top ${input.visibleCount} of ${formatCount(input.total)} active leads`
  }

  return `${formatCount(input.total)} ${input.tab} leads`
}

function normalizeSearchTerms(searchQuery?: string) {
  return (searchQuery ?? "")
    .trim()
    .split(/\s+/)
    .map((term) =>
      term
        .replace(/[(),]/g, "")
        .replaceAll("%", "\\%")
        .replaceAll("_", "\\_")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 5)
}

function applySearchFilter(queryBuilder: any, searchQuery?: string) {
  const terms = normalizeSearchTerms(searchQuery)

  if (terms.length === 0) {
    return queryBuilder
  }

  return terms.reduce(
    (builder, term) => {
      const filters = [
        `buyer_name.ilike.%${term}%`,
        `buyer_email.ilike.%${term}%`,
        `buyer_phone.ilike.%${term}%`,
        `summary.ilike.%${term}%`
      ]
      const recommendation = SEARCHABLE_RECOMMENDATIONS.find(
        (candidate) => candidate === term.toLowerCase()
      )

      if (recommendation) {
        filters.push(`recommendation.eq.${recommendation}`)
      }

      return builder.or(filters.join(","))
    },
    queryBuilder
  )
}

async function listScheduledAppointmentSummaries(
  client: AppSupabaseClient,
  leadIds: string[]
) {
  if (leadIds.length === 0) {
    return new Map<string, ScheduledAppointmentSummary>()
  }

  const { data, error } = await client
    .from("appointments")
    .select("lead_id, date, start_time")
    .eq("status", "scheduled")
    .in("lead_id", leadIds)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    throw error
  }

  const appointmentsByLeadId = new Map<string, ScheduledAppointmentSummary>()

  for (const appointment of data ?? []) {
    if (!appointmentsByLeadId.has(appointment.lead_id)) {
      appointmentsByLeadId.set(appointment.lead_id, {
        date: appointment.date,
        startTime: appointment.start_time
      })
    }
  }

  return appointmentsByLeadId
}

async function listUpcomingAppointmentSummaries(
  client: AppSupabaseClient,
  agentId: string
) {
  const today = new Date()
  const { data, error } = await client
    .from("appointments")
    .select("lead_id, date, start_time")
    .eq("status", "scheduled")
    .eq("agent_id", agentId)
    .gte("date", formatApiDate(today))
    .lte("date", formatApiDate(addDays(today, 7)))
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(75)

  if (error) {
    throw error
  }

  const appointmentsByLeadId = new Map<string, ScheduledAppointmentSummary>()

  for (const appointment of data ?? []) {
    if (!appointmentsByLeadId.has(appointment.lead_id)) {
      appointmentsByLeadId.set(appointment.lead_id, {
        date: appointment.date,
        startTime: appointment.start_time
      })
    }
  }

  return appointmentsByLeadId
}

async function listLatestLeadContactInteractions(
  client: AppSupabaseClient,
  agentId: string,
  leadIds: string[]
): Promise<Map<string, LeadContactInteraction>> {
  if (leadIds.length === 0) {
    return new Map()
  }

  const { data, error } = await client
    .from("lead_contact_interactions")
    .select(LEAD_CONTACT_INTERACTION_COLUMNS)
    .eq("agent_id", agentId)
    .in("lead_id", leadIds)
    .order("occurred_at", { ascending: false })

  if (error) {
    if (isMissingRelationError(error, "lead_contact_interactions")) {
      return new Map()
    }

    throw error
  }

  const latestByLeadId = new Map<string, LeadContactInteraction>()

  for (const row of data ?? []) {
    if (latestByLeadId.has(row.lead_id)) {
      continue
    }

    latestByLeadId.set(row.lead_id, mapLeadContactInteractionRecord(row))
  }

  return latestByLeadId
}

async function loadPipelineFocusCandidates(
  client: AppSupabaseClient,
  agentId: string
) {
  const upcomingAppointmentsByLeadId = await listUpcomingAppointmentSummaries(client, agentId)
  const appointmentLeadIds = Array.from(upcomingAppointmentsByLeadId.keys())
  const [{ data: activeRows, error: activeError }, appointmentLeadContext] = await Promise.all([
    client
      .from("leads")
      .select(LEAD_LIST_COLUMNS)
      .eq("agent_id", agentId)
      .in("pipeline_stage", PIPELINE_ACTIVE_STAGES)
      .order("updated_at", { ascending: false })
      .limit(250),
    appointmentLeadIds.length > 0
      ? client
          .from("leads")
          .select(LEAD_LIST_COLUMNS)
          .eq("agent_id", agentId)
          .in("id", appointmentLeadIds)
      : Promise.resolve({ data: [], error: null })
  ])

  if (activeError) {
    throw activeError
  }

  if (appointmentLeadContext.error) {
    throw appointmentLeadContext.error
  }

  const leadMap = new Map<string, PipelineLead>()

  for (const row of [...(activeRows ?? []), ...(appointmentLeadContext.data ?? [])]) {
    const pipelineLead = toPipelineLead(mapLeadRecord(row))
    if (isLeadInTab(pipelineLead, "active")) {
      leadMap.set(pipelineLead.id, pipelineLead)
    }
  }

  return {
    candidates: Array.from(leadMap.values()),
    upcomingAppointmentsByLeadId
  }
}

async function countPipelineRows(
  client: AppSupabaseClient,
  agentId: string,
  tab: PipelineLeadListQuery["tab"]
) {
  const { count, error } = await client
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .in("pipeline_stage", activeStagesForQuery(tab))

  if (error) {
    throw error
  }

  return count ?? 0
}

export async function listPipelineLeads(
  client: AppSupabaseClient,
  agentId: string,
  input: PipelineLeadListQuery
): Promise<PipelineLeadListResponse> {
  const hasSearch = Boolean(input.query)
  const hasSubmittedFilter = Boolean(input.submittedFrom || input.submittedTo)
  const isFocusQueue =
    input.tab === "active" &&
    input.category === "all" &&
    !hasSearch &&
    !hasSubmittedFilter &&
    input.offset === 0

  if (isFocusQueue) {
    const [{ candidates, upcomingAppointmentsByLeadId }, total] = await Promise.all([
      loadPipelineFocusCandidates(client, agentId),
      countPipelineRows(client, agentId, "active")
    ])
    const latestContactInteractionsByLeadId = await listLatestLeadContactInteractions(
      client,
      agentId,
      candidates.map((lead) => lead.id)
    )
    const leads = buildFocusQueue(
      candidates,
      upcomingAppointmentsByLeadId,
      latestContactInteractionsByLeadId,
      new Date(),
      input.limit
    )

    return {
      leads,
      total,
      mode: "focus_queue",
      summaryLabel: makeSummaryLabel({
        mode: "focus_queue",
        total,
        visibleCount: leads.length,
        tab: input.tab
      })
    }
  }

  const queryStages = pipelineStagesForQuery(input.tab, input.category)
  if (queryStages.length === 0) {
    return {
      leads: [],
      total: 0,
      mode: "filtered_results",
      summaryLabel: makeSummaryLabel({
        mode: "filtered_results",
        total: 0,
        visibleCount: 0,
        submittedFrom: input.submittedFrom,
        tab: input.tab
      })
    }
  }

  let queryBuilder = client
    .from("leads")
    .select(LEAD_LIST_COLUMNS, { count: "exact" })
    .eq("agent_id", agentId)
    .in("pipeline_stage", queryStages)
  queryBuilder = applyPipelineIntakeTypeFilter(queryBuilder, input.category)

  if (input.submittedFrom) {
    queryBuilder = queryBuilder.gte("submitted_at", input.submittedFrom)
  }

  if (input.submittedTo) {
    queryBuilder = queryBuilder.lt("submitted_at", input.submittedTo)
  }

  queryBuilder = applySearchFilter(queryBuilder, input.query)
  queryBuilder = queryBuilder
    .order(input.submittedFrom || input.submittedTo ? "submitted_at" : "updated_at", { ascending: false })
    .range(input.offset, input.offset + input.limit)

  const { data, error, count } = await queryBuilder

  if (error) {
    throw error
  }

  const fetchedRawLeads = (data ?? []).map((row: any) => toPipelineLead(mapLeadRecord(row)))
  const hasMore = fetchedRawLeads.length > input.limit
  const rawLeads = fetchedRawLeads.slice(0, input.limit)
  const leadIds = rawLeads.map((lead) => lead.id)
  const [appointmentsByLeadId, latestContactInteractionsByLeadId] = await Promise.all([
    listScheduledAppointmentSummaries(client, leadIds),
    input.tab === "active"
      ? listLatestLeadContactInteractions(client, agentId, leadIds)
      : Promise.resolve(new Map<string, LeadContactInteraction>())
  ])
  let leads: PipelineLead[] = rawLeads
    .filter((lead) => isLeadInTab(lead, input.tab))
    .filter((lead) => isLeadInCategory(lead, input.category))
    .map((lead) => {
      const displayStage = getPipelineDisplayStage(lead)
      const appointment = appointmentsByLeadId.get(lead.id)
      const latestContactInteraction = latestContactInteractionsByLeadId.get(lead.id)

      if (appointment) {
        return {
          ...lead,
          latestContactInteraction,
          attentionReason: `Showing scheduled ${appointment.date} at ${appointment.startTime}.`
        }
      }

      if (displayStage === "ready_to_show") {
        return {
          ...lead,
          latestContactInteraction,
          attentionReason: "Ready to show with no appointment scheduled."
        }
      }

      return {
        ...lead,
        latestContactInteraction
      }
    })

  if (input.tab === "active") {
    leads = prioritizeActivePipelineLeads(
      leads,
      appointmentsByLeadId,
      latestContactInteractionsByLeadId,
      new Date()
    )
  }
  const total = Math.max(
    count ?? 0,
    input.offset + rawLeads.length + (hasMore ? 1 : 0)
  )
  const nextOffset = hasMore ? input.offset + rawLeads.length : undefined

  return {
    leads,
    total,
    nextOffset,
    mode: "filtered_results",
    summaryLabel: makeSummaryLabel({
      mode: "filtered_results",
      total,
      visibleCount: leads.length,
      submittedFrom: input.submittedFrom,
      tab: input.tab
    })
  }
}

export async function listLeadIdsWithScheduledAppointments(
  client: AppSupabaseClient,
  agentId: string,
  leadIds?: string[]
) {
  if (leadIds && leadIds.length === 0) {
    return []
  }

  let queryBuilder = client
    .from("appointments")
    .select("lead_id")
    .eq("agent_id", agentId)
    .eq("status", "scheduled")

  if (leadIds) {
    queryBuilder = queryBuilder.in("lead_id", leadIds)
  }

  const { data, error } = await queryBuilder

  if (error) {
    throw error
  }

  return Array.from(new Set((data ?? []).map((appointment: any) => appointment.lead_id)))
}

export async function getAnalyticsSummary(
  client: AppSupabaseClient,
  agentId: string
): Promise<DashboardSummary> {
  const { data, error } = await client.rpc("get_agent_dashboard_summary", {
    p_agent_id: agentId
  })

  if (error) {
    throw error
  }

  const summary = Array.isArray(data) ? data[0] : data

  return {
    totalLeads: Number(summary?.total_leads ?? summary?.totalLeads ?? 0),
    newLeads: Number(summary?.new_leads ?? summary?.newLeads ?? 0),
    readyToShow: Number(summary?.ready_to_show ?? summary?.readyToShow ?? 0),
    appointmentBooked: Number(summary?.appointment_booked ?? summary?.appointmentBooked ?? 0),
    nurture: Number(summary?.nurture ?? 0),
    hold: Number(summary?.hold ?? 0),
    averageScore: Number(summary?.average_score ?? summary?.averageScore ?? 0)
  }
}

function isMissingRelationError(error: unknown, relationName: string) {
  const candidate = error as { code?: string; message?: string }
  return (
    candidate.code === "PGRST205" &&
    Boolean(candidate.message?.includes(relationName))
  )
}

export async function createInvite(client: AppSupabaseClient, agentId: string) {
  const { data, error } = await client
    .from("invites")
    .insert({
      agent_id: agentId,
      token: randomUUID(),
      status: "generated",
      token_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      draft_payload: {
        contact: {
          fullName: ""
        }
      },
      updated_at: nowIso()
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return mapInviteRecord(data)
}

export async function recordLeadContactInteraction(
  client: AppSupabaseClient,
  agentId: string,
  leadId: string,
  method: ContactMethod
): Promise<LeadContactInteraction> {
  const { data: lead, error: leadError } = await client
    .from("leads")
    .select("id")
    .eq("agent_id", agentId)
    .eq("id", leadId)
    .maybeSingle()

  if (leadError) {
    throw leadError
  }

  if (!lead) {
    throw new Error("Lead not found.")
  }

  const { data, error } = await client
    .from("lead_contact_interactions")
    .insert({
      agent_id: agentId,
      lead_id: leadId,
      method,
      occurred_at: nowIso()
    })
    .select(LEAD_CONTACT_INTERACTION_COLUMNS)
    .single()

  if (error) {
    throw error
  }

  return mapLeadContactInteractionRecord(data)
}

export async function getLeadById(client: AppSupabaseClient, agentId: string, leadId: string) {
  const { data: lead, error: leadError } = await client
    .from("leads")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", leadId)
    .maybeSingle()

  if (leadError) {
    throw leadError
  }

  if (!lead) {
    return null
  }

  const [
    { data: answerRows, error: answerError },
    { data: scoreRows, error: scoreError },
    { data: contactInteractionRows, error: contactInteractionError }
  ] =
    await Promise.all([
      client.from("lead_answers").select("*").eq("lead_id", leadId).order("updated_at", { ascending: true }),
      client.from("lead_scores").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1),
      client
        .from("lead_contact_interactions")
        .select(LEAD_CONTACT_INTERACTION_COLUMNS)
        .eq("agent_id", agentId)
        .eq("lead_id", leadId)
        .order("occurred_at", { ascending: false })
        .limit(5)
    ])

  if (answerError) {
    throw answerError
  }

  if (scoreError) {
    throw scoreError
  }

  if (contactInteractionError) {
    if (isMissingRelationError(contactInteractionError, "lead_contact_interactions")) {
      return mapLeadRecord(lead, answerRows ?? [], scoreRows?.[0], [])
    }

    throw contactInteractionError
  }

  return mapLeadRecord(lead, answerRows ?? [], scoreRows?.[0], contactInteractionRows ?? [])
}

export async function updateLeadStage(
  client: AppSupabaseClient,
  agentId: string,
  leadId: string,
  pipelineStage: LeadStage
) {
  const { data, error } = await client
    .from("leads")
    .update({
      pipeline_stage: pipelineStage,
      updated_at: nowIso()
    })
    .eq("agent_id", agentId)
    .eq("id", leadId)
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return mapLeadRecord(data)
}

export async function reviewLead(
  client: AppSupabaseClient,
  agentId: string,
  leadId: string,
  pipelineStage: Extract<LeadStage, "ready_to_show" | "nurture" | "hold">
) {
  const reviewedAt = nowIso()
  const { data, error } = await client
    .from("leads")
    .update({
      pipeline_stage: pipelineStage,
      reviewed_stage: pipelineStage,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt
    })
    .eq("agent_id", agentId)
    .eq("id", leadId)
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return mapLeadRecord(data)
}

export async function overrideLeadScore(
  client: AppSupabaseClient,
  agentId: string,
  leadId: string,
  overrideScore: number,
  note: string
) {
  const [leadContext, settingsContext, latestScoreContext, originalScoreContext] =
    await Promise.all([
      client.from("leads").select("*").eq("agent_id", agentId).eq("id", leadId).single(),
      client.from("agent_settings").select("show_threshold").eq("agent_id", agentId).single(),
      client.from("lead_scores").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1),
      client.from("lead_scores").select("*").eq("lead_id", leadId).eq("overridden", false).order("created_at", { ascending: false }).limit(1)
    ])

  if (leadContext.error) {
    throw leadContext.error
  }

  if (settingsContext.error) {
    throw settingsContext.error
  }

  if (latestScoreContext.error) {
    throw latestScoreContext.error
  }

  if (originalScoreContext.error) {
    throw originalScoreContext.error
  }

  const lead = requireData(leadContext.data, "Lead not found.")
  const settings = requireData(settingsContext.data, "Agent settings not found.")
  const latestScore = latestScoreContext.data?.[0]
  const originalScore = originalScoreContext.data?.[0] ?? latestScore

  if (!lead.recommendation || typeof lead.score !== "number") {
    throw new Error("Scored lead not found.")
  }

  const overrideRecommendation = recommendationForScore(
    overrideScore,
    settings.show_threshold
  )
  const overrideMeta: ScoreOverride = {
    id: randomUUID(),
    originalScore: originalScore?.total ?? lead.score,
    originalRecommendation: originalScore?.recommendation ?? lead.recommendation,
    overrideScore,
    overrideRecommendation,
    note,
    createdAt: nowIso(),
    createdByAgentId: agentId
  }

  const { error: scoreInsertError } = await client.from("lead_scores").insert({
    lead_id: leadId,
    total: overrideScore,
    recommendation: overrideRecommendation,
    summary: `Manual override to ${overrideScore.toFixed(2)}. ${note}`,
    breakdown: latestScore?.breakdown ?? {},
    overridden: true,
    override_meta: overrideMeta
  })

  if (scoreInsertError) {
    throw scoreInsertError
  }

  const { data, error } = await client
    .from("leads")
    .update({
      score: overrideScore,
      recommendation: overrideRecommendation,
      pipeline_stage: getSuggestedStage(overrideRecommendation) ?? "hold",
      summary: `Manual override to ${overrideScore.toFixed(2)}. ${note}`,
      updated_at: nowIso()
    })
    .eq("agent_id", agentId)
    .eq("id", leadId)
    .select("*")
    .single()

  if (error) {
    throw error
  }

  const { data: answerRows, error: answerError } = await client
    .from("lead_answers")
    .select("*")
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: true })

  if (answerError) {
    throw answerError
  }

  return mapLeadRecord(
    data,
    answerRows ?? [],
    {
      breakdown: latestScore?.breakdown ?? {},
      overridden: true,
      override_meta: overrideMeta
    }
  )
}

function getEmbeddedLead(appointment: any) {
  const lead = appointment.leads

  if (Array.isArray(lead)) {
    return lead[0]
  }

  return lead
}

export async function listAppointments(
  client: AppSupabaseClient,
  agentId: string,
  input: AppointmentListQuery | AppointmentStatus
): Promise<AppointmentListResponse> {
  const query = typeof input === "string" ? { status: input, limit: 25, offset: 0 } : input
  const { data: appointmentRows, error: appointmentError, count } = await client
    .from("appointments")
    .select(APPOINTMENT_LIST_COLUMNS, { count: "exact" })
    .eq("agent_id", agentId)
    .eq("status", query.status)
    .order("date", { ascending: query.status === "scheduled" })
    .order("start_time", { ascending: query.status === "scheduled" })
    .order("created_at", { ascending: false })
    .range(query.offset, query.offset + query.limit)

  if (appointmentError) {
    throw appointmentError
  }

  const fetchedAppointments = appointmentRows ?? []
  const hasMore = fetchedAppointments.length > query.limit
  const appointments = fetchedAppointments.slice(0, query.limit)
  if (appointments.length === 0) {
    return {
      appointments: [],
      total: count ?? 0
    }
  }

  const appointmentIds = appointments.map((appointment: any) => appointment.id)
  const { data: showingRows, error: showingError } = await client
    .from("showings")
    .select("*")
    .in("appointment_id", appointmentIds)
    .order("order_index", { ascending: true })

  if (showingError) {
    throw showingError
  }

  const showingMap = new Map<string, any[]>()

  for (const showing of showingRows ?? []) {
    const current = showingMap.get(showing.appointment_id) ?? []
    current.push(showing)
    showingMap.set(showing.appointment_id, current)
  }

  const mappedAppointments = appointments.map((appointment: any) =>
    mapAppointment(
      appointment,
      requireData(getEmbeddedLead(appointment), "Appointment lead not found."),
      showingMap.get(appointment.id) ?? []
    )
  )
  const total = Math.max(
    count ?? 0,
    query.offset + mappedAppointments.length + (hasMore ? 1 : 0)
  )

  return {
    appointments: mappedAppointments,
    total,
    nextOffset: hasMore ? query.offset + mappedAppointments.length : undefined
  }
}

export async function listAppointmentsForLead(client: AppSupabaseClient, agentId: string, leadId: string) {
  const { data: lead, error: leadError } = await client
    .from("leads")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", leadId)
    .maybeSingle()

  if (leadError) {
    throw leadError
  }

  if (!lead) {
    return []
  }

  const { data: appointmentRows, error: appointmentError } = await client
    .from("appointments")
    .select("*")
    .eq("agent_id", agentId)
    .eq("lead_id", leadId)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("created_at", { ascending: false })

  if (appointmentError) {
    throw appointmentError
  }

  const appointments = appointmentRows ?? []
  if (appointments.length === 0) {
    return []
  }

  const appointmentIds = appointments.map((appointment: any) => appointment.id)
  const { data: showingRows, error: showingError } = await client
    .from("showings")
    .select("*")
    .in("appointment_id", appointmentIds)
    .order("order_index", { ascending: true })

  if (showingError) {
    throw showingError
  }

  const showingMap = new Map<string, any[]>()

  for (const showing of showingRows ?? []) {
    const current = showingMap.get(showing.appointment_id) ?? []
    current.push(showing)
    showingMap.set(showing.appointment_id, current)
  }

  return appointments.map((appointment: any) =>
    mapAppointment(appointment, lead, showingMap.get(appointment.id) ?? [])
  )
}

export async function createAppointment(
  client: AppSupabaseClient,
  agentId: string,
  input: {
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
  const normalizedShowings = normalizeShowingsInput(input.showings)
  if (normalizedShowings.length === 0) {
    throw new Error("Add at least one showing before saving the appointment.")
  }

  const { data: lead, error: leadError } = await client
    .from("leads")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", input.leadId)
    .maybeSingle()

  if (leadError) {
    throw leadError
  }

  const leadRow = requireData(lead, "Lead not found.")
  if (!canCreateAppointmentForLead(leadRow.pipeline_stage)) {
    throw new Error("Appointments can only be created for ready, nurture, or hold leads.")
  }

  const { data: existingScheduled, error: existingError } = await client
    .from("appointments")
    .select("*")
    .eq("agent_id", agentId)
    .eq("lead_id", input.leadId)
    .eq("status", "scheduled")
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existingScheduled) {
    throw new Error("This lead already has a scheduled appointment.")
  }

  const { data: appointment, error: appointmentError } = await client.rpc(
    "create_agent_appointment",
    {
      p_agent_id: agentId,
      p_lead_id: input.leadId,
      p_date: input.date,
      p_start_time: input.startTime,
      p_notes: input.notes?.trim() || null,
      p_showings: normalizedShowings.map((showing) => ({
        address: showing.address,
        notes: showing.notes ?? null
      }))
    }
  )

  if (appointmentError) {
    throw appointmentError
  }

  const { data: showingRows, error: showingRowsError } = await client
    .from("showings")
    .select("*")
    .eq("appointment_id", appointment.id)
    .order("order_index", { ascending: true })

  if (showingRowsError) {
    throw showingRowsError
  }

  return mapAppointment(appointment, leadRow, showingRows ?? [])
}

export async function updateAppointment(
  client: AppSupabaseClient,
  agentId: string,
  appointmentId: string,
  input: {
    date: string
    startTime: string
    notes?: string
    showings: {
      address: string
      notes?: string
    }[]
  }
) {
  const normalizedShowings = normalizeShowingsInput(input.showings)
  if (normalizedShowings.length === 0) {
    throw new Error("Add at least one showing before saving the appointment.")
  }

  const { data: appointment, error: appointmentLookupError } = await client
    .from("appointments")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", appointmentId)
    .maybeSingle()

  if (appointmentLookupError) {
    throw appointmentLookupError
  }

  const appointmentRow = requireData(appointment, "Appointment not found.")
  const { data: lead, error: leadError } = await client
    .from("leads")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", appointmentRow.lead_id)
    .maybeSingle()

  if (leadError) {
    throw leadError
  }

  const leadRow = requireData(lead, "Lead not found.")

  const { data: updatedAppointment, error: updateError } = await client.rpc(
    "update_agent_appointment",
    {
      p_agent_id: agentId,
      p_appointment_id: appointmentId,
      p_date: input.date,
      p_start_time: input.startTime,
      p_notes: input.notes?.trim() || null,
      p_showings: normalizedShowings.map((showing) => ({
        address: showing.address,
        notes: showing.notes ?? null
      }))
    }
  )

  if (updateError) {
    throw updateError
  }

  const { data: showingRows, error: showingRowsError } = await client
    .from("showings")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("order_index", { ascending: true })

  if (showingRowsError) {
    throw showingRowsError
  }

  return mapAppointment(updatedAppointment, leadRow, showingRows ?? [])
}

export async function updateAppointmentStatus(
  client: AppSupabaseClient,
  agentId: string,
  appointmentId: string,
  status: "scheduled" | "completed" | "cancelled"
) {
  const { data: appointment, error: appointmentLookupError } = await client
    .from("appointments")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", appointmentId)
    .maybeSingle()

  if (appointmentLookupError) {
    throw appointmentLookupError
  }

  const appointmentRow = requireData(appointment, "Appointment not found.")
  const { data: lead, error: leadError } = await client
    .from("leads")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", appointmentRow.lead_id)
    .maybeSingle()

  if (leadError) {
    throw leadError
  }

  const leadRow = requireData(lead, "Lead not found.")
  const { data: updatedAppointment, error: updateError } = await client
    .from("appointments")
    .update({ status })
    .eq("agent_id", agentId)
    .eq("id", appointmentId)
    .select("*")
    .single()

  if (updateError) {
    throw updateError
  }

  const { data: showingRows, error: showingRowsError } = await client
    .from("showings")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("order_index", { ascending: true })

  if (showingRowsError) {
    throw showingRowsError
  }

  return mapAppointment(updatedAppointment, leadRow, showingRows ?? [])
}

export async function completeOnboarding(
  client: AppSupabaseClient,
  agentId: string,
  input: OnboardingInput
) {
  if (input.customQuestions.length > 2) {
    throw new Error("Phase 1 only allows up to two custom context questions.")
  }

  const [{ data: settings, error: settingsError }, { data: templates, error: templateLookupError }] =
    await Promise.all([
      client.from("agent_settings").select("*").eq("agent_id", agentId).single(),
      client.from("question_templates").select("*").eq("agent_id", agentId)
    ])

  if (settingsError) {
    throw settingsError
  }

  if (templateLookupError) {
    throw templateLookupError
  }

  const template = resolveTemplateForIntakeType(
    input.intakeType,
    (templates ?? []).map((entry: any) => mapQuestionTemplate(entry))
  )
  const timestamp = nowIso()

  const { error: agentError } = await client
    .from("agents")
    .update({
      full_name: input.fullName,
      brokerage: input.brokerage || null,
      license_number: input.licenseNumber || null,
      onboarded_at: timestamp
    })
    .eq("id", agentId)

  if (agentError) {
    throw agentError
  }

  const { error: settingUpdateError } = await updateAgentSettings(client, agentId, {
    brand_name: input.brandName,
    brand_color: input.brandColor,
    accent_color: input.accentColor,
    show_threshold: input.showThreshold,
    email_notifications_enabled: input.emailNotificationsEnabled
  })

  if (settingUpdateError) {
    throw settingUpdateError
  }

  const { error: templateError } = await client
    .from("question_templates")
    .update({
      intro_headline: input.introHeadline,
      intro_body: input.introBody,
      custom_questions: input.customQuestions
    })
    .eq("id", template.id)

  if (templateError) {
    throw templateError
  }

  return getAgentContext(client, agentId)
}

async function upsertLeadAnswersFromDraft(
  client: AppSupabaseClient,
  leadId: string,
  draft: IntakeDraft
) {
  const flattened = flattenDraftAnswers(draft)
  const answerUpserts = Object.entries(flattened).map(([questionKey, answerValue]) => ({
    lead_id: leadId,
    question_key: questionKey,
    answer_value: answerValue,
    scored: questionKey.startsWith("buyer.") || questionKey.startsWith("rental."),
    updated_at: nowIso()
  }))

  if (answerUpserts.length === 0) {
    return
  }

  const { error: deleteError } = await client.from("lead_answers").delete().eq("lead_id", leadId)

  if (deleteError) {
    throw deleteError
  }

  const { error: insertError } = await client.from("lead_answers").insert(answerUpserts)

  if (insertError) {
    throw insertError
  }
}

async function ensureLeadForInvite(
  client: AppSupabaseClient,
  inviteRow: any,
  draft: IntakeDraft
) {
  if (inviteRow.lead_id) {
    return inviteRow.lead_id
  }

  if (!draft.intent || !draft.contact.fullName.trim() || (!draft.contact.email?.trim() && !draft.contact.phone?.trim())) {
    return undefined
  }

  const leadInput = buildLeadInputFromDraft(draft)
  const { data: lead, error: leadError } = await client
    .from("leads")
    .insert({
      agent_id: inviteRow.agent_id,
      buyer_name: leadInput.buyerName,
      buyer_email: leadInput.buyerEmail ?? null,
      buyer_phone: leadInput.buyerPhone ?? null,
      intake_type: leadInput.intakeType,
      token: inviteRow.token,
      token_expires_at: inviteRow.token_expires_at,
      status: "pending",
      pipeline_stage: "new",
      updated_at: nowIso()
    })
    .select("id")
    .single()

  if (leadError) {
    throw leadError
  }

  const { error: inviteError } = await client
    .from("invites")
    .update({
      lead_id: lead.id,
      status: "converted",
      converted_at: nowIso(),
      updated_at: nowIso()
    })
    .eq("id", inviteRow.id)

  if (inviteError) {
    throw inviteError
  }

  return lead.id
}

export async function getPublicFormConfig(
  client: AppSupabaseClient,
  agentId: string
): Promise<PublicFormConfig> {
  const [
    { data: agent, error: agentError },
    { data: settings, error: settingsError },
    { data: templates, error: templateError }
  ] = await Promise.all([
    client
      .from("agents")
      .select("full_name, brokerage")
      .eq("id", agentId)
      .maybeSingle(),
    client
      .from("agent_settings")
      .select("brand_name, brand_color, accent_color")
      .eq("agent_id", agentId)
      .maybeSingle(),
    client.from("question_templates").select("*").eq("agent_id", agentId)
  ])

  if (agentError) {
    throw agentError
  }

  if (settingsError) {
    throw settingsError
  }

  if (templateError) {
    throw templateError
  }

  const mappedTemplates = (templates ?? []).map((entry: any) => mapQuestionTemplate(entry))

  return {
    branding: buildPublicIntakeBranding({
      fullName: agent?.full_name,
      brokerage: agent?.brokerage,
      brandName: settings?.brand_name,
      brandColor: settings?.brand_color,
      accentColor: settings?.accent_color
    }),
    settings: settings
      ? {
          brandName: settings.brand_name,
          brandColor: settings.brand_color,
          accentColor: settings.accent_color
        }
      : undefined,
    templates: {
      sale: resolveTemplateForIntakeType("sale", mappedTemplates),
      rental: resolveTemplateForIntakeType("rental", mappedTemplates)
    }
  }
}

export const getCachedPublicFormConfig = unstable_cache(
  async (agentId: string) => {
    const client = createSupabaseAdminClient()
    return getPublicFormConfig(client, agentId)
  },
  ["public-intake-form-config-v2"],
  {
    revalidate: 300
  }
)

export async function getPublicLeadIntakeContext(
  client: AppSupabaseClient,
  token: string,
  loadConfig: PublicFormConfigLoader = getCachedPublicFormConfig
) {
  const { data: invite, error: inviteError } = await client
    .from("invites")
    .select("id, agent_id, lead_id, token_expires_at, draft_payload")
    .eq("token", token)
    .maybeSingle()

  if (inviteError) {
    throw inviteError
  }

  if (!invite) {
    return null
  }

  const { data: leadStatus, error: leadError } = invite.lead_id
    ? await client
        .from("leads")
        .select("status, intake_type")
        .eq("id", invite.lead_id)
        .maybeSingle()
    : { data: null, error: null }

  if (leadError) {
    throw leadError
  }

  const [config] = await Promise.all([loadConfig(invite.agent_id)])
  const parsedDraft = (invite.draft_payload as IntakeDraft | null) ?? {
    contact: {
      fullName: ""
    }
  }
  const draftIntent =
    parsedDraft.intent ??
    (leadStatus?.intake_type ? intakeTypeToIntent(leadStatus.intake_type) : undefined)

  return {
    draft: parsedDraft,
    branding: config.branding,
    isExpired: new Date(invite.token_expires_at).getTime() < Date.now(),
    leadStatus: leadStatus?.status,
    settings: config.settings,
    templates: config.templates,
    questions: draftIntent
      ? {
          required: getRequiredQuestionsForIntent(draftIntent),
          optional: getOptionalQuestionsForIntent(draftIntent)
        }
      : {
          required: [],
          optional: []
        }
  }
}

export async function getLeadIntakeContext(client: AppSupabaseClient, token: string) {
  const { data: invite, error: inviteError } = await client
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle()

  if (inviteError) {
    throw inviteError
  }

  if (!invite) {
    return null
  }

  const [
    { data: agent, error: agentError },
    { data: settings, error: settingsError },
    { data: templates, error: templateError },
    leadContext
  ] = await Promise.all([
    client.from("agents").select("*").eq("id", invite.agent_id).single(),
    client.from("agent_settings").select("*").eq("agent_id", invite.agent_id).single(),
    client.from("question_templates").select("*").eq("agent_id", invite.agent_id),
    invite.lead_id
      ? client.from("leads").select("*").eq("id", invite.lead_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ])

  if (agentError) {
    throw agentError
  }

  if (settingsError) {
    throw settingsError
  }

  if (templateError) {
    throw templateError
  }

  if (leadContext.error) {
    throw leadContext.error
  }

  let lead: Lead | undefined

  if (invite.lead_id && leadContext.data) {
    const [{ data: answerRows, error: answerError }, latestScore] = await Promise.all([
      client.from("lead_answers").select("*").eq("lead_id", invite.lead_id).order("updated_at", { ascending: true }),
      client.from("lead_scores").select("*").eq("lead_id", invite.lead_id).order("created_at", { ascending: false }).limit(1)
    ])

    if (answerError) {
      throw answerError
    }

    if (latestScore.error) {
      throw latestScore.error
    }

    lead = mapLeadRecord(leadContext.data, answerRows ?? [], latestScore.data?.[0])
  }

  const mappedTemplates = (templates ?? []).map((entry: any) => mapQuestionTemplate(entry))
  const parsedDraft = (invite.draft_payload as IntakeDraft | null) ?? {
    contact: {
      fullName: ""
    }
  }
  const draftIntent = parsedDraft.intent ?? (lead ? intakeTypeToIntent(lead.intakeType) : undefined)

  return {
    invite: mapInviteRecord(invite),
    lead,
    draft: parsedDraft,
    agent: mapAgentProfile(agent),
    settings: mapAgentSettings(settings),
    templates: {
      sale: resolveTemplateForIntakeType("sale", mappedTemplates),
      rental: resolveTemplateForIntakeType("rental", mappedTemplates)
    },
    isExpired: new Date(invite.token_expires_at).getTime() < Date.now(),
    questions: draftIntent
      ? {
          required: getRequiredQuestionsForIntent(draftIntent),
          optional: getOptionalQuestionsForIntent(draftIntent)
        }
      : {
          required: [],
          optional: []
        }
  }
}

export async function autosaveInviteDraft(
  client: AppSupabaseClient,
  token: string,
  draft: IntakeDraft
) {
  const { data: invite, error: inviteError } = await client
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle()

  if (inviteError) {
    throw inviteError
  }

  if (!invite) {
    throw new Error("Invite not found.")
  }

  if (new Date(invite.token_expires_at).getTime() < Date.now()) {
    throw new Error("This intake link has expired.")
  }

  await autosaveInviteDraftForInvite(client, invite, draft)
}

async function autosaveInviteDraftForInvite(
  client: AppSupabaseClient,
  invite: any,
  draft: IntakeDraft
) {
  const leadId = await ensureLeadForInvite(client, invite, draft)

  if (leadId) {
    const { data: lead, error: leadError } = await client
      .from("leads")
      .select("status")
      .eq("id", leadId)
      .single()

    if (leadError) {
      throw leadError
    }

    assertLeadIntakeMutable(lead.status)
  }

  const { error: inviteUpdateError } = await client
    .from("invites")
    .update({
      draft_payload: draft,
      status: leadId ? "converted" : "opened",
      opened_at: invite.opened_at ?? nowIso(),
      updated_at: nowIso()
    })
    .eq("id", invite.id)

  if (inviteUpdateError) {
    throw inviteUpdateError
  }

  if (leadId) {
    const leadInput = buildLeadInputFromDraft(draft)
    const { error: leadUpdateError } = await client
      .from("leads")
      .update({
        buyer_name: leadInput.buyerName,
        buyer_email: leadInput.buyerEmail ?? null,
        buyer_phone: leadInput.buyerPhone ?? null,
        intake_type: leadInput.intakeType,
        updated_at: nowIso()
      })
      .eq("id", leadId)

    if (leadUpdateError) {
      throw leadUpdateError
    }

    await upsertLeadAnswersFromDraft(client, leadId, draft)
  }

  return leadId
}

async function loadSubmittedInviteResult(
  client: AppSupabaseClient,
  agentId: string,
  leadId: string
) {
  const [
    { data: settingsRow, error: settingsError },
    { data: leadRow, error: leadReadError },
    { data: answerRows, error: answerRowsError },
    { data: latestScoreRows, error: latestScoreError }
  ] = await Promise.all([
    client.from("agent_settings").select("*").eq("agent_id", agentId).single(),
    client.from("leads").select("*").eq("id", leadId).single(),
    client.from("lead_answers").select("*").eq("lead_id", leadId).order("updated_at", { ascending: true }),
    client.from("lead_scores").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1)
  ])

  if (settingsError) {
    throw settingsError
  }

  if (leadReadError) {
    throw leadReadError
  }

  if (answerRowsError) {
    throw answerRowsError
  }

  if (latestScoreError) {
    throw latestScoreError
  }

  return {
    lead: mapLeadRecord(leadRow, answerRows ?? [], latestScoreRows?.[0]),
    settings: mapAgentSettings(settingsRow)
  }
}

async function finalizeSubmittedInvite(
  client: AppSupabaseClient,
  input: {
    agentId: string
    leadId: string
    score: number
    recommendation: Recommendation
    summary: string
    breakdown: ScoreBreakdown
  }
) {
  const { data, error } = await client.rpc("finalize_submitted_invite", {
    p_agent_id: input.agentId,
    p_lead_id: input.leadId,
    p_score: input.score,
    p_recommendation: input.recommendation,
    p_summary: input.summary,
    p_breakdown: input.breakdown
  })

  if (error) {
    throw error
  }

  return requireData(data, "Lead not found.")
}

export async function submitInvite(
  client: AppSupabaseClient,
  token: string,
  input: SubmitInviteInput
) {
  const { data: invite, error: inviteError } = await client
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle()

  if (inviteError) {
    throw inviteError
  }

  if (!invite) {
    throw new Error("Invite not found.")
  }

  if (new Date(invite.token_expires_at).getTime() < Date.now()) {
    throw new Error("This intake link has expired.")
  }

  assertDraftSubmissionComplete(input.draft)

  if (invite.lead_id) {
    const { data: existingLead, error: existingLeadError } = await client
      .from("leads")
      .select("status")
      .eq("id", invite.lead_id)
      .maybeSingle()

    if (existingLeadError) {
      throw existingLeadError
    }

    if (existingLead?.status === "submitted") {
      return loadSubmittedInviteResult(client, invite.agent_id, invite.lead_id)
    }
  }

  const leadId = await autosaveInviteDraftForInvite(client, invite, input.draft)

  if (!leadId) {
    throw new Error("Lead not found.")
  }

  const [{ data: settingsRow, error: settingsError }, { data: leadRow, error: leadReadError }] =
    await Promise.all([
      client.from("agent_settings").select("*").eq("agent_id", invite.agent_id).single(),
      client.from("leads").select("*").eq("id", leadId).single()
    ])

  if (settingsError) {
    throw settingsError
  }

  if (leadReadError) {
    throw leadReadError
  }

  assertLeadIntakeMutable(leadRow.status)
  const settings = mapAgentSettings(settingsRow)
  const submission = input.draft as IntakeSubmission
  const scored = scoreLead(submission, settings.showThreshold)
  const persistedSummary = `${scored.summary} ${scored.nextAction}`.trim()
  const lead = await finalizeSubmittedInvite(client, {
    agentId: invite.agent_id,
    leadId,
    score: scored.total,
    recommendation: scored.recommendation,
    summary: persistedSummary,
    breakdown: scored.breakdown
  })

  const [
    { data: answerRows, error: answerRowsError },
    { data: latestScoreRows, error: latestScoreError }
  ] = await Promise.all([
    client.from("lead_answers").select("*").eq("lead_id", leadId).order("updated_at", { ascending: true }),
    client.from("lead_scores").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1)
  ])

  if (answerRowsError) {
    throw answerRowsError
  }

  if (latestScoreError) {
    throw latestScoreError
  }

  return {
    lead: mapLeadRecord(lead, answerRows ?? [], latestScoreRows?.[0]),
    settings
  }
}

export async function recordProductEvents(
  client: AppSupabaseClient,
  agentId: string,
  events: ProductEvent[]
) {
  if (events.length === 0) {
    return {
      acceptedCount: 0,
      rejectedCount: 0,
      rejectedEventIds: []
    }
  }

  const rows = events.map((event) => ({
    id: event.id,
    agent_id: agentId,
    workspace_id: event.workspaceId ?? null,
    actor_id: event.actorId ?? null,
    event_name: event.eventName,
    resource_type: event.resourceType ?? null,
    resource_id: event.resourceId ?? null,
    platform: event.platform,
    app_version: event.appVersion ?? null,
    build_number: event.buildNumber ?? null,
    route: event.route ?? null,
    properties: event.properties,
    occurred_at: event.occurredAt
  }))

  const { error } = await client.from("product_events").upsert(rows, {
    onConflict: "id",
    ignoreDuplicates: true
  })

  if (error) {
    throw error
  }

  return {
    acceptedCount: events.length,
    rejectedCount: 0,
    rejectedEventIds: []
  }
}

export async function recordAuditEvents(
  client: AppSupabaseClient,
  agentId: string,
  events: AuditEvent[]
) {
  if (events.length === 0) {
    return {
      acceptedCount: 0,
      rejectedCount: 0,
      rejectedEventIds: []
    }
  }

  const rows = events.map((event) => ({
    id: event.id,
    agent_id: agentId,
    workspace_id: event.workspaceId ?? null,
    actor_id: event.actorId ?? null,
    actor_type: event.actorType,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId ?? null,
    request_ip: event.requestIp ?? null,
    user_agent: event.userAgent ?? null,
    platform: event.platform ?? null,
    app_version: event.appVersion ?? null,
    before_summary: event.beforeSummary,
    after_summary: event.afterSummary,
    metadata: event.metadata,
    occurred_at: event.occurredAt
  }))

  const { error } = await client.from("audit_events").upsert(rows, {
    onConflict: "id",
    ignoreDuplicates: true
  })

  if (error) {
    throw error
  }

  return {
    acceptedCount: events.length,
    rejectedCount: 0,
    rejectedEventIds: []
  }
}

export async function recordConsentRecords(
  client: AppSupabaseClient,
  agentId: string,
  records: ConsentRecord[]
) {
  if (records.length === 0) {
    return {
      acceptedCount: 0,
      rejectedCount: 0,
      rejectedEventIds: []
    }
  }

  const rows = records.map((record) => ({
    id: record.id,
    subject_type: record.subjectType,
    subject_id: record.subjectId ?? null,
    agent_id: agentId,
    consent_type: record.consentType,
    status: record.status,
    policy_version: record.policyVersion ?? null,
    source: record.source ?? null,
    metadata: record.metadata,
    occurred_at: record.occurredAt,
    expires_at: record.expiresAt ?? null
  }))

  const { error } = await client.from("consent_records").upsert(rows, {
    onConflict: "id",
    ignoreDuplicates: true
  })

  if (error) {
    throw error
  }

  return {
    acceptedCount: records.length,
    rejectedCount: 0,
    rejectedEventIds: []
  }
}

export async function createPrivacyRequest(
  client: AppSupabaseClient,
  input: {
    agentId?: string
    requesterEmail?: string
    requestType: "account_deletion" | "data_deletion"
    source: "mobile-settings" | "public-web"
    note?: string
    metadata?: Record<string, unknown>
  }
) {
  const id = randomUUID()
  const { error } = await client.from("privacy_requests").insert({
    id,
    agent_id: input.agentId ?? null,
    requester_email: input.requesterEmail ?? null,
    request_type: input.requestType,
    status: "requested",
    source: input.source,
    note: input.note?.trim() || null,
    metadata: input.metadata ?? {}
  })

  if (error) {
    throw error
  }

  return {
    id
  }
}

export async function recordAgentFeedback(
  client: AppSupabaseClient,
  agentId: string,
  input: {
    message: string
    source: "mobile-settings"
  }
) {
  const { error } = await client.from("agent_feedback").insert({
    agent_id: agentId,
    message: input.message,
    source: input.source
  })

  if (error) {
    throw error
  }

  return { ok: true as const }
}

export async function recordDiagnosticEvents(
  client: AppSupabaseClient,
  agentId: string,
  events: DiagnosticsEvent[]
) {
  if (events.length === 0) {
    return {
      acceptedCount: 0,
      rejectedCount: 0,
      rejectedEventIds: []
    }
  }

  const rows = events.map((event) => ({
    id: event.id,
    agent_id: agentId,
    device_id: event.deviceId,
    session_id: event.sessionId,
    event_type: event.eventType,
    category: event.category,
    severity: event.severity,
    message: event.message,
    fingerprint: event.fingerprint ?? null,
    screen: event.screen ?? null,
    app_version: event.appVersion ?? null,
    build_number: event.buildNumber ?? null,
    platform: event.platform,
    request_path: event.requestPath ?? null,
    http_status: event.httpStatus ?? null,
    lead_id: event.leadId ?? null,
    appointment_id: event.appointmentId ?? null,
    pipeline_stage: event.pipelineStage ?? null,
    context: event.context,
    breadcrumbs: event.breadcrumbs,
    tags: event.tags,
    occurred_at: event.occurredAt
  }))

  const { error } = await client.from("diagnostic_events").upsert(rows, {
    onConflict: "id",
    ignoreDuplicates: true
  })

  if (error) {
    throw error
  }

  return {
    acceptedCount: events.length,
    rejectedCount: 0,
    rejectedEventIds: []
  }
}
