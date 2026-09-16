import type { DiagnosticsBreadcrumb, DiagnosticsEvent } from "@showready/contracts"

export type DiagnosticsStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export type DiagnosticsSessionState = {
  sessionId: string
  deviceId: string
  active: boolean
}

type DiagnosticsStoreOptions = {
  storage: DiagnosticsStorage
  createId?: () => string
  maxQueueSize?: number
  maxBreadcrumbs?: number
}

const DEFAULT_MAX_QUEUE_SIZE = 50
const DEFAULT_MAX_BREADCRUMBS = 30
const DEVICE_ID_KEY = "showready.diagnostics.device-id"
const SESSION_STATE_KEY = "showready.diagnostics.session-state"
const QUEUE_KEY = "showready.diagnostics.queue"
const BREADCRUMBS_KEY = "showready.diagnostics.breadcrumbs"

const LOW_PRIORITY_SEVERITIES = new Set<DiagnosticsEvent["severity"]>(["debug", "info", "warning"])

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

async function readJson<T>(storage: DiagnosticsStorage, key: string, fallback: T): Promise<T> {
  const rawValue = await storage.getItem(key)

  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

async function writeJson(storage: DiagnosticsStorage, key: string, value: unknown) {
  await storage.setItem(key, JSON.stringify(value))
}

function trimQueuedEvents(events: DiagnosticsEvent[], maxQueueSize: number) {
  const nextEvents = [...events]

  while (nextEvents.length > maxQueueSize) {
    const removableIndex = nextEvents.findIndex((event) => LOW_PRIORITY_SEVERITIES.has(event.severity))

    if (removableIndex >= 0) {
      nextEvents.splice(removableIndex, 1)
      continue
    }

    nextEvents.shift()
  }

  return nextEvents
}

function trimBreadcrumbs(breadcrumbs: DiagnosticsBreadcrumb[], maxBreadcrumbs: number) {
  if (breadcrumbs.length <= maxBreadcrumbs) {
    return breadcrumbs
  }

  return breadcrumbs.slice(breadcrumbs.length - maxBreadcrumbs)
}

export function createDiagnosticsStore({
  storage,
  createId = createRandomId,
  maxQueueSize = DEFAULT_MAX_QUEUE_SIZE,
  maxBreadcrumbs = DEFAULT_MAX_BREADCRUMBS
}: DiagnosticsStoreOptions) {
  return {
    async getOrCreateDeviceId() {
      const existingDeviceId = await storage.getItem(DEVICE_ID_KEY)

      if (existingDeviceId) {
        return existingDeviceId
      }

      const deviceId = createId()
      await storage.setItem(DEVICE_ID_KEY, deviceId)
      return deviceId
    },

    async getSessionState() {
      return readJson<DiagnosticsSessionState | null>(storage, SESSION_STATE_KEY, null)
    },

    async setSessionState(state: DiagnosticsSessionState) {
      await writeJson(storage, SESSION_STATE_KEY, state)
    },

    async getQueuedEvents() {
      return readJson<DiagnosticsEvent[]>(storage, QUEUE_KEY, [])
    },

    async enqueueEvent(event: DiagnosticsEvent) {
      const queuedEvents = await this.getQueuedEvents()
      const nextEvents = trimQueuedEvents([...queuedEvents, event], maxQueueSize)
      await writeJson(storage, QUEUE_KEY, nextEvents)
      return nextEvents
    },

    async removeQueuedEvents(eventIds: string[]) {
      const queuedEvents = await this.getQueuedEvents()
      const remainingEvents = queuedEvents.filter((event) => !eventIds.includes(event.id))
      await writeJson(storage, QUEUE_KEY, remainingEvents)
      return remainingEvents
    },

    async getBreadcrumbs() {
      return readJson<DiagnosticsBreadcrumb[]>(storage, BREADCRUMBS_KEY, [])
    },

    async setBreadcrumbs(breadcrumbs: DiagnosticsBreadcrumb[]) {
      await writeJson(storage, BREADCRUMBS_KEY, trimBreadcrumbs(breadcrumbs, maxBreadcrumbs))
    },

    async appendBreadcrumb(breadcrumb: DiagnosticsBreadcrumb) {
      const breadcrumbs = await this.getBreadcrumbs()
      const nextBreadcrumbs = trimBreadcrumbs([...breadcrumbs, breadcrumb], maxBreadcrumbs)
      await writeJson(storage, BREADCRUMBS_KEY, nextBreadcrumbs)
      return nextBreadcrumbs
    },

    async clearBreadcrumbs() {
      await storage.removeItem(BREADCRUMBS_KEY)
    }
  }
}

export type DiagnosticsStore = ReturnType<typeof createDiagnosticsStore>
