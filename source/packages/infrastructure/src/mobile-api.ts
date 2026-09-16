import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AccountDeletionRequest,
  Appointment,
  AppointmentInitialDataResponse,
  AppointmentListQuery,
  AppointmentListResponse,
  AuditEventBatch,
  ContactMethod,
  ConsentRecordBatch,
  DiagnosticsBatch,
  DiagnosticsBatchResponse,
  DashboardSummary,
  FeedbackSubmission,
  FeedbackSubmissionResponse,
  FirstPartyEventBatchResponse,
  HomeDataResponse,
  Lead,
  LeadMutation,
  LeadContactInteraction,
  LeadListQuery,
  LeadListResponse,
  PipelineLeadListQuery,
  PipelineLeadListResponse,
  ProductEventBatch
} from "@showready/contracts"
import { AppointmentInitialDataResponseSchema } from "@showready/contracts"
import { AppointmentListResponseSchema } from "@showready/contracts"
import { CreateInviteResponseSchema } from "@showready/contracts"
import { DiagnosticsBatchResponseSchema } from "@showready/contracts"
import { DashboardSummarySchema } from "@showready/contracts"
import { FeedbackSubmissionResponseSchema } from "@showready/contracts"
import { FirstPartyEventBatchResponseSchema } from "@showready/contracts"
import { HomeDataResponseSchema } from "@showready/contracts"
import { LeadSchema } from "@showready/contracts"
import { LeadListResponseSchema } from "@showready/contracts"
import { LeadContactInteractionSchema } from "@showready/contracts"
import { PipelineLeadListResponseSchema } from "@showready/contracts"
import { MobileApiError } from "./errors"

type MobileApiClientOptions = {
  supabase: SupabaseClient
  apiBaseUrl: string
  getAccessToken: () => Promise<string | null>
  fetcher?: typeof fetch
  cacheTtlMs?: number
  now?: () => number
  onRequestError?: (input: {
    path: string
    method: string
    status: number
    message: string
  }) => Promise<void> | void
}

export function createMobileApiClient({
  supabase,
  apiBaseUrl,
  getAccessToken,
  fetcher = fetch,
  cacheTtlMs = 30_000,
  now = Date.now,
  onRequestError
}: MobileApiClientOptions) {
  const readCache = new Map<string, { accessToken: string | null; expiresAt: number; value: unknown }>()

  function getCachedValue<T>(path: string, accessToken: string | null): T | undefined {
    const entry = readCache.get(path)

    if (!entry) {
      return undefined
    }

    if (entry.expiresAt <= now()) {
      readCache.delete(path)
      return undefined
    }

    if (entry.accessToken !== accessToken) {
      readCache.delete(path)
      return undefined
    }

    return entry.value as T
  }

  function setCachedValue(path: string, value: unknown, accessToken: string | null) {
    if (cacheTtlMs <= 0) {
      return
    }

    readCache.set(path, {
      accessToken,
      value,
      expiresAt: now() + cacheTtlMs
    })
  }

  function clearReadCache() {
    readCache.clear()
  }

  async function authorizedFetch(
    path: string,
    init: RequestInit = {},
    accessToken?: string | null
  ) {
    const token = accessToken === undefined ? await getAccessToken() : accessToken
    const headers = new Headers(init.headers)

    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    return fetcher(`${apiBaseUrl}${path}`, {
      ...init,
      headers
    })
  }

  async function request(
    path: string,
    init: RequestInit = {},
    message: string,
    accessToken?: string | null
  ) {
    const method = init.method ?? "GET"

    if (method !== "GET") {
      clearReadCache()
    }

    try {
      return await authorizedFetch(path, init, accessToken)
    } catch {
      return handleApiFailure(path, method, 0, message)
    }
  }

  async function handleApiFailure(path: string, method: string, status: number, message: string): Promise<never> {
    await onRequestError?.({
      path,
      method,
      status,
      message
    })

    throw new MobileApiError(status, message)
  }

  async function parseJsonResponse<T>(input: {
    path: string
    method: string
    response: Response
    message: string
    parse: (payload: unknown) => T
  }) {
    try {
      return input.parse(await input.response.json())
    } catch {
      return handleApiFailure(input.path, input.method, input.response.status, input.message)
    }
  }

  async function getJson<T>(input: {
    path: string
    message: string
    parse: (payload: unknown) => T
    cache?: boolean
  }) {
    const accessToken = await getAccessToken()

    if (input.cache !== false) {
      const cached = getCachedValue<T>(input.path, accessToken)

      if (cached !== undefined) {
        return cached
      }
    }

    const response = await request(input.path, {}, input.message, accessToken)

    if (!response.ok) {
      return handleApiFailure(input.path, "GET", response.status, input.message)
    }

    const parsed = await parseJsonResponse({
      path: input.path,
      method: "GET",
      response,
      message: input.message,
      parse: input.parse
    })

    if (input.cache !== false) {
      setCachedValue(input.path, parsed, accessToken)
    }

    return parsed
  }

  function buildLeadListPath(input: Partial<LeadListQuery> = {}) {
    const searchParams = new URLSearchParams()
    searchParams.set("scope", input.scope ?? "all")

    if (input.query) {
      searchParams.set("query", input.query)
    }

    searchParams.set("limit", String(input.limit ?? 25))
    searchParams.set("offset", String(input.offset ?? 0))

    return `/api/mobile/leads?${searchParams.toString()}`
  }

  function buildAppointmentListPath(input: Partial<AppointmentListQuery> = {}) {
    const searchParams = new URLSearchParams()
    searchParams.set("status", input.status ?? "scheduled")
    searchParams.set("limit", String(input.limit ?? 25))
    searchParams.set("offset", String(input.offset ?? 0))

    return `/api/mobile/appointments?${searchParams.toString()}`
  }

  function buildAppointmentsInitialPath(input: Partial<AppointmentListQuery> & { leadLimit?: number } = {}) {
    const searchParams = new URLSearchParams()
    searchParams.set("status", input.status ?? "scheduled")
    searchParams.set("limit", String(input.limit ?? 25))
    searchParams.set("offset", String(input.offset ?? 0))
    searchParams.set("leadLimit", String(input.leadLimit ?? 3))

    return `/api/mobile/appointments/initial?${searchParams.toString()}`
  }

  function buildLeadExportPath(input: {
    fromDate: string
    toDate: string
    timeZone?: string
  }) {
    const searchParams = new URLSearchParams()
    searchParams.set("from", input.fromDate)
    searchParams.set("to", input.toDate)

    if (input.timeZone) {
      searchParams.set("timeZone", input.timeZone)
    }

    return `/api/mobile/leads/export.csv?${searchParams.toString()}`
  }

  function parseContentDispositionFileName(value: string | null) {
    const match = value?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
    return match?.[1] ? decodeURIComponent(match[1]) : undefined
  }

  return {
    clearCache() {
      clearReadCache()
    },

    async getHomeData(): Promise<HomeDataResponse> {
      const path = "/api/mobile/home"

      return getJson({
        path,
        message: "Unable to load home data.",
        parse: (payload) => HomeDataResponseSchema.parse(payload)
      })
    },

    async getDashboardSummary(): Promise<DashboardSummary> {
      const path = "/api/mobile/dashboard"

      return getJson({
        path,
        message: "Unable to load dashboard summary.",
        parse: (payload) => DashboardSummarySchema.parse(payload)
      })
    },

    async createInvite() {
      const path = "/api/mobile/invites"
      const response = await request(path, { method: "POST" }, "Unable to create invite.")

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to create invite.")
      }

      return parseJsonResponse({
        path,
        method: "POST",
        response,
        message: "Unable to create invite.",
        parse: (payload) => CreateInviteResponseSchema.parse(payload)
      })
    },

    async listNewLeads(input: Partial<Omit<LeadListQuery, "scope">> | string = {}): Promise<LeadListResponse> {
      const normalizedInput = typeof input === "string" ? {} : input
      const path = buildLeadListPath({
        ...normalizedInput,
        scope: "new"
      })

      return getJson({
        path,
        message: "Unable to load new leads.",
        parse: (payload) => LeadListResponseSchema.parse(payload)
      })
    },

    async listLeads(input: Partial<LeadListQuery> | string = {}): Promise<LeadListResponse> {
      const path = buildLeadListPath(typeof input === "string" ? {} : input)

      return getJson({
        path,
        message: "Unable to load leads.",
        parse: (payload) => LeadListResponseSchema.parse(payload)
      })
    },

    async createLead(input: LeadMutation): Promise<{ lead: Lead }> {
      const path = "/api/mobile/leads"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to create lead."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to create lead.")
      }

      return parseJsonResponse({
        path,
        method: "POST",
        response,
        message: "Unable to create lead.",
        parse: (payload) => ({
          lead: LeadSchema.parse((payload as { lead?: unknown }).lead)
        })
      })
    },

    async exportLeadsCsv(input: {
      fromDate: string
      toDate: string
      timeZone?: string
    }): Promise<{
      fileName: string
      csv: string
      rowCount: number
    }> {
      const path = buildLeadExportPath(input)
      const response = await request(path, {}, "Unable to export leads.")

      if (!response.ok) {
        return handleApiFailure(path, "GET", response.status, "Unable to export leads.")
      }

      const rowCount = Number.parseInt(response.headers.get("x-lead-export-count") ?? "0", 10)

      return {
        fileName:
          parseContentDispositionFileName(response.headers.get("content-disposition")) ??
          `showready-leads-${input.fromDate}-to-${input.toDate}.csv`,
        csv: await response.text(),
        rowCount: Number.isFinite(rowCount) ? rowCount : 0
      }
    },

    async listPipelineLeads(input: Partial<PipelineLeadListQuery>): Promise<PipelineLeadListResponse> {
      const searchParams = new URLSearchParams()
      const query = {
        tab: input.tab ?? "active",
        category: input.category ?? "all",
        query: input.query,
        submittedFrom: input.submittedFrom,
        submittedTo: input.submittedTo,
        limit: input.limit ?? 25,
        offset: input.offset ?? 0
      }

      searchParams.set("tab", query.tab)
      searchParams.set("category", query.category)

      if (query.query) {
        searchParams.set("query", query.query)
      }

      if (query.submittedFrom) {
        searchParams.set("submittedFrom", query.submittedFrom)
      }

      if (query.submittedTo) {
        searchParams.set("submittedTo", query.submittedTo)
      }

      searchParams.set("limit", String(query.limit))
      searchParams.set("offset", String(query.offset))

      const path = `/api/mobile/pipeline/leads?${searchParams.toString()}`

      return getJson({
        path,
        message: "Unable to load pipeline leads.",
        parse: (payload) => PipelineLeadListResponseSchema.parse(payload)
      })
    },

    async getLeadById(leadId: string): Promise<Lead | null> {
      const path = `/api/mobile/leads/${leadId}`
      const response = await request(path, {}, "Unable to load lead.")

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        return handleApiFailure(path, "GET", response.status, "Unable to load lead.")
      }

      const payload = (await response.json()) as { lead: Lead }
      return payload.lead
    },

    async updateLead(leadId: string, input: LeadMutation): Promise<{ lead: Lead }> {
      const path = `/api/mobile/leads/${leadId}`
      const response = await request(
        path,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to update lead."
      )

      if (!response.ok) {
        return handleApiFailure(path, "PATCH", response.status, "Unable to update lead.")
      }

      return parseJsonResponse({
        path,
        method: "PATCH",
        response,
        message: "Unable to update lead.",
        parse: (payload) => ({
          lead: LeadSchema.parse((payload as { lead?: unknown }).lead)
        })
      })
    },

    async deleteLead(leadId: string): Promise<{ ok: true }> {
      const path = `/api/mobile/leads/${leadId}`
      const response = await request(
        path,
        {
          method: "DELETE"
        },
        "Unable to delete lead."
      )

      if (!response.ok) {
        return handleApiFailure(path, "DELETE", response.status, "Unable to delete lead.")
      }

      return (await response.json()) as { ok: true }
    },

    async reviewLead(leadId: string, pipelineStage: "ready_to_show" | "nurture" | "hold") {
      const path = "/api/mobile/reviews"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            leadId,
            pipelineStage
          })
        },
        "Unable to review lead."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to review lead.")
      }

      return (await response.json()) as { lead: Lead }
    },

    async moveLead(
      leadId: string,
      pipelineStage: "ready_to_show" | "nurture" | "hold" | "closed_won" | "closed_lost" | "archived"
    ) {
      const path = `/api/mobile/leads/${leadId}/stage`
      const response = await request(
        path,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ pipelineStage })
        },
        "Unable to move lead."
      )

      if (!response.ok) {
        return handleApiFailure(path, "PATCH", response.status, "Unable to move lead.")
      }

      return (await response.json()) as { lead: Lead }
    },

    async listAppointments(
      input: Partial<AppointmentListQuery> | Appointment["status"] = {}
    ): Promise<AppointmentListResponse> {
      const path = buildAppointmentListPath(typeof input === "string" ? { status: input } : input)

      return getJson({
        path,
        message: "Unable to load appointments.",
        parse: (payload) => AppointmentListResponseSchema.parse(payload)
      })
    },

    async getAppointmentsInitialData(
      input: Partial<AppointmentListQuery> & { leadLimit?: number } = {}
    ): Promise<AppointmentInitialDataResponse> {
      const path = buildAppointmentsInitialPath(input)

      return getJson({
        path,
        message: "Unable to load appointment data.",
        parse: (payload) => AppointmentInitialDataResponseSchema.parse(payload)
      })
    },

    async saveAppointment(input: {
      appointmentId?: string
      leadId: string
      date: string
      startTime: string
      notes?: string
      showings: {
        address: string
        notes?: string
      }[]
    }) {
      const path = "/api/mobile/appointments"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to save appointment."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to save appointment.")
      }

      return (await response.json()) as { appointment: Appointment }
    },

    async updateAppointmentStatus(appointmentId: string, status: "scheduled" | "completed" | "cancelled") {
      const path = `/api/mobile/appointments/${appointmentId}/status`
      const response = await request(
        path,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status })
        },
        "Unable to update appointment status."
      )

      if (!response.ok) {
        return handleApiFailure(path, "PATCH", response.status, "Unable to update appointment status.")
      }

      return (await response.json()) as { appointment: Appointment }
    },

    async saveSettings(input: {
      fullName: string
      brokerage?: string
      licenseNumber?: string
      emailNotificationsEnabled: boolean
    }) {
      const path = "/api/mobile/settings"
      const response = await request(
        path,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to save settings."
      )

      if (!response.ok) {
        return handleApiFailure(path, "PUT", response.status, "Unable to save settings.")
      }

      return (await response.json()) as { ok: true }
    },

    async submitFeedback(input: FeedbackSubmission): Promise<FeedbackSubmissionResponse> {
      const path = "/api/mobile/feedback"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to submit feedback."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to submit feedback.")
      }

      return parseJsonResponse({
        path,
        method: "POST",
        response,
        message: "Unable to submit feedback.",
        parse: (payload) => FeedbackSubmissionResponseSchema.parse(payload)
      })
    },

    async getSettings() {
      const path = "/api/mobile/settings"
      const response = await request(path, {}, "Unable to load settings.")

      if (!response.ok) {
        return handleApiFailure(path, "GET", response.status, "Unable to load settings.")
      }

      return (await response.json()) as {
        fullName: string
        brokerage?: string
        licenseNumber?: string
        emailNotificationsEnabled: boolean
        brandName: string
        brandColor: string
        accentColor: string
        showThreshold: number
      }
    },

    async registerPushToken(input: {
      expoPushToken: string
      platform: "ios" | "android" | "unknown"
    }) {
      const path = "/api/mobile/push-tokens"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to register push token."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to register push token.")
      }

      return (await response.json()) as { ok: true }
    },

    async overrideLeadScore(leadId: string, input: { overrideScore: number; note: string }) {
      const path = `/api/mobile/leads/${leadId}/override-score`
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to override score."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to override score.")
      }

      return (await response.json()) as { lead: Lead }
    },

    async recordLeadContactInteraction(
      leadId: string,
      method: ContactMethod
    ): Promise<{ interaction: LeadContactInteraction }> {
      const path = `/api/mobile/leads/${leadId}/contact-interactions`
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ method })
        },
        "Unable to record contact interaction."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to record contact interaction.")
      }

      return parseJsonResponse({
        path,
        method: "POST",
        response,
        message: "Unable to record contact interaction.",
        parse: (payload) => ({
          interaction: LeadContactInteractionSchema.parse(
            (payload as { interaction?: unknown }).interaction
          )
        })
      })
    },

    async submitProductEvents(input: ProductEventBatch): Promise<FirstPartyEventBatchResponse> {
      const path = "/api/mobile/events"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to submit product events."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to submit product events.")
      }

      return parseJsonResponse({
        path,
        method: "POST",
        response,
        message: "Unable to submit product events.",
        parse: (payload) => FirstPartyEventBatchResponseSchema.parse(payload)
      })
    },

    async submitAuditEvents(input: AuditEventBatch): Promise<FirstPartyEventBatchResponse> {
      const path = "/api/mobile/audit-events"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to submit audit events."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to submit audit events.")
      }

      return parseJsonResponse({
        path,
        method: "POST",
        response,
        message: "Unable to submit audit events.",
        parse: (payload) => FirstPartyEventBatchResponseSchema.parse(payload)
      })
    },

    async submitConsentRecords(input: ConsentRecordBatch): Promise<FirstPartyEventBatchResponse> {
      const path = "/api/mobile/consent-records"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to submit consent records."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to submit consent records.")
      }

      return parseJsonResponse({
        path,
        method: "POST",
        response,
        message: "Unable to submit consent records.",
        parse: (payload) => FirstPartyEventBatchResponseSchema.parse(payload)
      })
    },

    async requestAccountDeletion(input: AccountDeletionRequest = {}): Promise<{ ok: true; requestId: string }> {
      const path = "/api/mobile/account-deletion"
      const response = await request(
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        },
        "Unable to request account deletion."
      )

      if (!response.ok) {
        return handleApiFailure(path, "POST", response.status, "Unable to request account deletion.")
      }

      const payload = (await response.json()) as { ok?: boolean; requestId?: unknown }

      if (payload.ok !== true || typeof payload.requestId !== "string") {
        return handleApiFailure(path, "POST", response.status, "Unable to request account deletion.")
      }

      return {
        ok: true,
        requestId: payload.requestId
      }
    },

    async submitDiagnostics(input: DiagnosticsBatch): Promise<DiagnosticsBatchResponse> {
      const path = "/api/mobile/diagnostics"
      const response = await authorizedFetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      })

      if (!response.ok) {
        throw new MobileApiError(response.status, "Unable to submit diagnostics.")
      }

      return parseJsonResponse({
        path,
        method: "POST",
        response,
        message: "Unable to submit diagnostics.",
        parse: (payload) => DiagnosticsBatchResponseSchema.parse(payload)
      })
    }
  }
}
