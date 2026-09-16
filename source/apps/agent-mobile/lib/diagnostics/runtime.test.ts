import type { DiagnosticsBatch, DiagnosticsBatchResponse } from "@showready/contracts"
import { DiagnosticsEventSchema } from "@showready/contracts"
import { createDiagnosticsStore } from "./store"
import { createDiagnosticsRuntime } from "./runtime"

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key)
    })
  }
}

describe("createDiagnosticsRuntime", () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto
    })
  })

  it("generates contract-valid UUID event ids when global crypto is unavailable", async () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined
    })

    const storage = createMemoryStorage()
    const store = createDiagnosticsStore({
      storage,
      createId: () => "device-1",
      maxQueueSize: 10,
      maxBreadcrumbs: 5
    })

    const runtime = createDiagnosticsRuntime({
      store,
      transport: {
        submitDiagnostics: jest.fn<Promise<DiagnosticsBatchResponse>, [DiagnosticsBatch]>()
      },
      now: () => "2026-04-21T12:00:00.000Z",
      platform: "ios"
    })

    await runtime.logEvent({
      eventType: "action.event",
      category: "action",
      severity: "info",
      message: "Action event"
    })

    const [event] = await store.getQueuedEvents()

    expect(() => DiagnosticsEventSchema.parse(event)).not.toThrow()
  })

  it("omits invalid network failure status values from diagnostics events", async () => {
    const storage = createMemoryStorage()
    const store = createDiagnosticsStore({
      storage,
      createId: () => "device-1",
      maxQueueSize: 10,
      maxBreadcrumbs: 5
    })

    const runtime = createDiagnosticsRuntime({
      store,
      transport: {
        submitDiagnostics: jest.fn<Promise<DiagnosticsBatchResponse>, [DiagnosticsBatch]>()
      },
      now: () => "2026-04-21T12:00:00.000Z",
      createId: () => "0c59f42d-ece8-4c07-a4ff-2358a0c1553f",
      platform: "ios"
    })

    await runtime.logEvent({
      eventType: "api.failure",
      category: "api",
      severity: "error",
      message: "Unable to load pipeline leads.",
      requestPath: "/api/mobile/pipeline/leads?query=buyer@example.com",
      httpStatus: 0
    })

    const [event] = await store.getQueuedEvents()

    expect(event.httpStatus).toBeUndefined()
    expect(() => DiagnosticsEventSchema.parse(event)).not.toThrow()
  })

  it("queues an inferred crash event when the previous session stayed active", async () => {
    const storage = createMemoryStorage()
    const store = createDiagnosticsStore({
      storage,
      createId: () => "device-1",
      maxQueueSize: 10,
      maxBreadcrumbs: 5
    })

    await store.setSessionState({
      sessionId: "previous-session",
      deviceId: "device-1",
      active: true
    })
    await store.setBreadcrumbs([
      {
        timestamp: "2026-04-21T11:59:30.000Z",
        type: "navigation",
        message: "Visited /home",
        data: {
          route: "/home"
        }
      }
    ])

    const runtime = createDiagnosticsRuntime({
      store,
      transport: {
        submitDiagnostics: jest.fn<Promise<DiagnosticsBatchResponse>, [DiagnosticsBatch]>()
      },
      now: () => "2026-04-21T12:00:00.000Z",
      createId: () => "current-session",
      platform: "ios",
      appVersion: "0.1.0",
      buildNumber: "42"
    })

    await runtime.startSession()

    await expect(store.getQueuedEvents()).resolves.toEqual([
      expect.objectContaining({
        eventType: "crash.inferred",
        sessionId: "previous-session",
        context: {
          previousSessionId: "previous-session"
        },
        breadcrumbs: [
          {
            timestamp: "2026-04-21T11:59:30.000Z",
            type: "navigation",
            message: "Visited /home",
            data: {
              route: "/home"
            }
          }
        ]
      })
    ])
  })

  it("flushes queued diagnostics and clears them after a successful submit", async () => {
    const storage = createMemoryStorage()
    const store = createDiagnosticsStore({
      storage,
      createId: () => "device-1",
      maxQueueSize: 10,
      maxBreadcrumbs: 5
    })
    const submitDiagnostics = jest.fn<Promise<DiagnosticsBatchResponse>, [DiagnosticsBatch]>(async () => ({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    }))

    const runtime = createDiagnosticsRuntime({
      store,
      transport: {
        submitDiagnostics
      },
      now: () => "2026-04-21T12:00:00.000Z",
      createId: () => "session-1",
      platform: "ios",
      appVersion: "0.1.0",
      buildNumber: "42"
    })

    await runtime.startSession()
    await runtime.captureError(new Error("Unable to restore session."), {
      eventType: "error.handled",
      category: "error",
      severity: "error",
      context: {
        route: "/sign-in",
        email: "buyer@example.com"
      }
    })

    await runtime.flush()

    expect(submitDiagnostics).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({
          eventType: "error.handled",
          category: "error",
          severity: "error",
          message: "Unable to restore session.",
          context: expect.objectContaining({
            route: "/sign-in"
          })
        })
      ]
    })
    await expect(store.getQueuedEvents()).resolves.toEqual([])
  })
})
