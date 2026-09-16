import type {
  DiagnosticsBatch,
  DiagnosticsBatchResponse,
  DiagnosticsBreadcrumb,
  DiagnosticsCategory,
  DiagnosticsEvent,
  DiagnosticsEventType,
  DiagnosticsMetadata,
  DiagnosticsPlatform,
  DiagnosticsSeverity
} from "@showready/contracts"
import {
  sanitizeDiagnosticsMetadata,
  sanitizeDiagnosticsPath,
  sanitizeDiagnosticsText
} from "./redaction"
import type { DiagnosticsStore } from "./store"

type DiagnosticsTransport = {
  submitDiagnostics: (batch: DiagnosticsBatch) => Promise<DiagnosticsBatchResponse>
}

type LogEventInput = {
  eventType: DiagnosticsEventType
  category: DiagnosticsCategory
  severity: DiagnosticsSeverity
  message: string
  fingerprint?: string
  screen?: string
  requestPath?: string
  httpStatus?: number
  leadId?: string
  appointmentId?: string
  pipelineStage?: string
  context?: DiagnosticsMetadata
  tags?: DiagnosticsMetadata
}

type CaptureErrorInput = Omit<LogEventInput, "message">

type AddBreadcrumbInput = {
  type: string
  message: string
  data?: DiagnosticsMetadata
}

type DiagnosticsRuntimeOptions = {
  store: DiagnosticsStore
  transport: DiagnosticsTransport
  platform: DiagnosticsPlatform
  appVersion?: string
  buildNumber?: string
  batchSize?: number
  now?: () => string
  createId?: () => string
}

const DEFAULT_BATCH_SIZE = 20

function createFallbackUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (part) => {
    const randomValue = Math.floor(Math.random() * 16)
    const value = part === "x" ? randomValue : (randomValue & 0x3) | 0x8
    return value.toString(16)
  })
}

function createRandomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return createFallbackUuid()
}

function normalizeHttpStatus(status: number | undefined) {
  if (typeof status !== "number" || status < 100 || status > 599) {
    return undefined
  }

  return status
}

export function createDiagnosticsRuntime({
  store,
  transport,
  platform,
  appVersion,
  buildNumber,
  batchSize = DEFAULT_BATCH_SIZE,
  now = () => new Date().toISOString(),
  createId = createRandomId
}: DiagnosticsRuntimeOptions) {
  let currentSessionId: string | null = null
  let currentDeviceId: string | null = null

  async function logEvent(input: LogEventInput) {
    const currentSession = await ensureSession()
    const event = await buildEvent(input, currentSession.sessionId, currentSession.deviceId)

    await store.enqueueEvent(event)
    return event
  }

  async function ensureSession() {
    if (currentSessionId && currentDeviceId) {
      return {
        sessionId: currentSessionId,
        deviceId: currentDeviceId
      }
    }

    const existingSession = await store.getSessionState()

    if (existingSession) {
      currentSessionId = existingSession.sessionId
      currentDeviceId = existingSession.deviceId

      return {
        sessionId: existingSession.sessionId,
        deviceId: existingSession.deviceId
      }
    }

    return startSession()
  }

  async function buildEvent(input: LogEventInput, sessionId: string, deviceId: string): Promise<DiagnosticsEvent> {
    return {
      id: createId(),
      sessionId,
      deviceId,
      occurredAt: now(),
      eventType: input.eventType,
      category: input.category,
      severity: input.severity,
      message: sanitizeDiagnosticsText(input.message),
      fingerprint: input.fingerprint ? sanitizeDiagnosticsText(input.fingerprint, 256) : undefined,
      screen: input.screen ? sanitizeDiagnosticsPath(input.screen) : undefined,
      appVersion,
      buildNumber,
      platform,
      requestPath: input.requestPath ? sanitizeDiagnosticsPath(input.requestPath) : undefined,
      httpStatus: normalizeHttpStatus(input.httpStatus),
      leadId: input.leadId,
      appointmentId: input.appointmentId,
      pipelineStage: input.pipelineStage,
      context: sanitizeDiagnosticsMetadata(input.context),
      breadcrumbs: await store.getBreadcrumbs(),
      tags: sanitizeDiagnosticsMetadata(input.tags)
    }
  }

  async function startSession() {
    const previousSession = await store.getSessionState()
    const previousBreadcrumbs = await store.getBreadcrumbs()
    const deviceId = await store.getOrCreateDeviceId()
    const sessionId = createId()

    if (previousSession?.active) {
      await store.enqueueEvent({
        id: createId(),
        sessionId: previousSession.sessionId,
        deviceId: previousSession.deviceId,
        occurredAt: now(),
        eventType: "crash.inferred",
        category: "crash",
        severity: "fatal",
        message: "Previous app session ended unexpectedly.",
        platform,
        appVersion,
        buildNumber,
        context: {
          previousSessionId: previousSession.sessionId
        },
        breadcrumbs: previousBreadcrumbs,
        tags: {}
      })
    }

    await store.setSessionState({
      sessionId,
      deviceId,
      active: true
    })
    await store.clearBreadcrumbs()

    currentSessionId = sessionId
    currentDeviceId = deviceId

    return {
      sessionId,
      deviceId
    }
  }

  return {
    async startSession() {
      return startSession()
    },

    async markSessionActive() {
      const currentSession = await ensureSession()

      await store.setSessionState({
        ...currentSession,
        active: true
      })
    },

    async markSessionInactive() {
      const currentSession = await ensureSession()

      await store.setSessionState({
        ...currentSession,
        active: false
      })
    },

    async addBreadcrumb(input: AddBreadcrumbInput): Promise<DiagnosticsBreadcrumb> {
      const breadcrumb = {
        timestamp: now(),
        type: input.type,
        message: input.message,
        data: sanitizeDiagnosticsMetadata(input.data)
      }

      await store.appendBreadcrumb(breadcrumb)
      return breadcrumb
    },

    async logEvent(input: LogEventInput) {
      return logEvent(input)
    },

    async captureError(error: unknown, input: CaptureErrorInput) {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error."
      const stack =
        error instanceof Error && error.stack
          ? ({
              stack: error.stack
            } satisfies DiagnosticsMetadata)
          : undefined

      return logEvent({
        ...input,
        message,
        context: {
          ...stack,
          ...(input.context ?? {})
        }
      })
    },

    async flush() {
      const queuedEvents = await store.getQueuedEvents()

      if (queuedEvents.length === 0) {
        return null
      }

      const batchEvents = queuedEvents.slice(0, batchSize)

      try {
        const response = await transport.submitDiagnostics({
          events: batchEvents
        })

        await store.removeQueuedEvents(batchEvents.map((event) => event.id))

        return response
      } catch {
        return null
      }
    }
  }
}
