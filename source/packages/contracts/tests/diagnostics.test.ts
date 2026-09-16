import { describe, expect, it } from "vitest"
import { DiagnosticsBatchSchema, DiagnosticsEventSchema } from "../src"

describe("DiagnosticsEventSchema", () => {
  it("parses a diagnostics event with breadcrumbs and redacted context", () => {
    const parsed = DiagnosticsEventSchema.parse({
      id: "0c59f42d-ece8-4c07-a4ff-2358a0c1553f",
      sessionId: "session-1",
      deviceId: "device-1",
      occurredAt: "2026-04-21T12:00:00.000Z",
      eventType: "api.failure",
      category: "api",
      severity: "error",
      message: "Unable to load dashboard summary.",
      fingerprint: "api.failure:/api/mobile/dashboard:500",
      platform: "ios",
      appVersion: "0.1.0",
      buildNumber: "42",
      requestPath: "/api/mobile/dashboard",
      httpStatus: 500,
      leadId: "lead-1",
      screen: "/home",
      context: {
        route: "/home",
        pipelineStage: "ready_to_show",
        attempt: 1
      },
      breadcrumbs: [
        {
          timestamp: "2026-04-21T11:59:50.000Z",
          type: "navigation",
          message: "Visited /home",
          data: {
            route: "/home"
          }
        }
      ],
      tags: {
        source: "mobile-api"
      }
    })

    expect(parsed.eventType).toBe("api.failure")
    expect(parsed.breadcrumbs).toHaveLength(1)
    expect(parsed.context).toEqual({
      route: "/home",
      pipelineStage: "ready_to_show",
      attempt: 1
    })
  })

  it("rejects diagnostics events without a stable id", () => {
    expect(() =>
      DiagnosticsEventSchema.parse({
        sessionId: "session-1",
        deviceId: "device-1",
        occurredAt: "2026-04-21T12:00:00.000Z",
        eventType: "error.handled",
        category: "error",
        severity: "error",
        message: "Something failed.",
        platform: "ios"
      })
    ).toThrow()
  })

  it("rejects oversized diagnostics strings and unexpected fields", () => {
    expect(() =>
      DiagnosticsEventSchema.parse({
        id: "0c59f42d-ece8-4c07-a4ff-2358a0c1553f",
        sessionId: "s".repeat(129),
        deviceId: "device-1",
        occurredAt: "2026-04-21T12:00:00.000Z",
        eventType: "error.handled",
        category: "error",
        severity: "error",
        message: "Something failed.",
        platform: "ios",
        unexpected: true
      })
    ).toThrow()
  })
})

describe("DiagnosticsBatchSchema", () => {
  it("requires at least one diagnostics event", () => {
    expect(() =>
      DiagnosticsBatchSchema.parse({
        events: []
      })
    ).toThrow()
  })
})
