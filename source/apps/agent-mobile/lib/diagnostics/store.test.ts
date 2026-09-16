import type { DiagnosticsEvent } from "@showready/contracts"
import { createDiagnosticsStore } from "./store"

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

function createEvent(overrides: Partial<DiagnosticsEvent>): DiagnosticsEvent {
  return {
    id: "0c59f42d-ece8-4c07-a4ff-2358a0c1553f",
    sessionId: "session-1",
    deviceId: "device-1",
    occurredAt: "2026-04-21T12:00:00.000Z",
    eventType: "action.event",
    category: "action",
    severity: "info",
    message: "Action event",
    platform: "ios",
    context: {},
    breadcrumbs: [],
    tags: {},
    ...overrides
  }
}

describe("createDiagnosticsStore", () => {
  it("drops the oldest low-severity event before discarding higher-severity entries", async () => {
    const storage = createMemoryStorage()
    const store = createDiagnosticsStore({
      storage,
      maxQueueSize: 2,
      maxBreadcrumbs: 5,
      createId: () => "device-1"
    })

    await store.enqueueEvent(
      createEvent({
        id: "feffdbd1-6c0b-40c1-b242-998b485d8b4a",
        message: "Old info event",
        severity: "info"
      })
    )
    await store.enqueueEvent(
      createEvent({
        id: "b2dfce69-2cd7-4043-b8a8-71efee8addce",
        eventType: "error.handled",
        category: "error",
        severity: "error",
        message: "Important error"
      })
    )
    await store.enqueueEvent(
      createEvent({
        id: "02412f14-1f52-4df2-93de-1cff32a5f36c",
        message: "Newest info event",
        severity: "info"
      })
    )

    await expect(store.getQueuedEvents()).resolves.toEqual([
      expect.objectContaining({
        id: "b2dfce69-2cd7-4043-b8a8-71efee8addce",
        message: "Important error"
      }),
      expect.objectContaining({
        id: "02412f14-1f52-4df2-93de-1cff32a5f36c",
        message: "Newest info event"
      })
    ])
  })
})
