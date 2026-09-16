import { beforeEach, describe, expect, it, vi } from "vitest"
import { MobileAuthError } from "@/lib/mobile-auth"
import { POST } from "./route"

const { mockCreateSupabaseAdminClient, mockRequireMobileAgent, mockRecordDiagnosticEvents, mockRequestErrorResponse } = vi.hoisted(() => ({
  mockCreateSupabaseAdminClient: vi.fn(),
  mockRequireMobileAgent: vi.fn(),
  mockRecordDiagnosticEvents: vi.fn(),
  mockRequestErrorResponse: vi.fn(async (input: { response: { error: string }; status: number }) =>
    Response.json(input.response, { status: input.status })
  )
}))

vi.mock("@/lib/mobile-auth", () => ({
  MobileAuthError: class MobileAuthError extends Error {
    status: number

    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
  mobileErrorResponse: (error: { message: string; status: number; headers?: HeadersInit }) =>
    Response.json({ error: error.message }, { status: error.status, headers: error.headers }),
  requireMobileAgent: mockRequireMobileAgent
}))

vi.mock("@/lib/supabase/data", () => ({
  recordDiagnosticEvents: mockRecordDiagnosticEvents
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

describe("POST /api/mobile/diagnostics", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockRecordDiagnosticEvents.mockReset()
    mockRequestErrorResponse.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })

    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })

    mockRecordDiagnosticEvents.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
  })

  it("stores valid diagnostics events for authenticated agents and redacts blocked fields", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/diagnostics", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          events: [
            {
              id: "0c59f42d-ece8-4c07-a4ff-2358a0c1553f",
              sessionId: "session-1",
              deviceId: "device-1",
              occurredAt: "2026-04-21T12:00:00.000Z",
              eventType: "api.failure",
              category: "api",
              severity: "error",
              message: "Unable to load buyer@example.com with Bearer production-token.",
              platform: "ios",
              screen: "/home",
              requestPath: "/api/mobile/dashboard?email=buyer@example.com&limit=25",
              httpStatus: 500,
              leadId: "lead-1",
              context: {
                route: "/home",
                leadId: "lead-1",
                email: "buyer@example.com",
                authToken: "secret-token",
                notes: "private note"
              },
              breadcrumbs: [
                {
                  timestamp: "2026-04-21T11:59:50.000Z",
                  type: "navigation",
                  message: "Visited /home",
                  data: {
                    route: "/home",
                    phone: "416-555-0101"
                  }
                }
              ]
            }
          ]
        })
      })
    )

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    expect(mockRecordDiagnosticEvents).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      expect.arrayContaining([
        expect.objectContaining({
          id: "0c59f42d-ece8-4c07-a4ff-2358a0c1553f",
          leadId: "lead-1",
          message: "Unable to load [redacted-email] with Bearer [redacted]",
          requestPath: "/api/mobile/dashboard?email&limit",
          context: {
            route: "/home",
            leadId: "lead-1"
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
          ]
        })
      ])
    )
  })

  it("returns 400 for an empty diagnostics batch", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/diagnostics", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          events: []
        })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Diagnostics batch must contain at least one event."
    })
    expect(mockRecordDiagnosticEvents).not.toHaveBeenCalled()
  })

  it("returns diagnostics auth errors without storing backend error events", async () => {
    mockRequireMobileAgent.mockRejectedValueOnce(
      new MobileAuthError(429, "Too many mobile API requests. Please try again shortly.")
    )

    const response = await POST(
      new Request("http://localhost/api/mobile/diagnostics", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          events: [
            {
              id: "0c59f42d-ece8-4c07-a4ff-2358a0c1553f",
              sessionId: "session-1",
              deviceId: "device-1",
              occurredAt: "2026-04-21T12:00:00.000Z",
              eventType: "api.failure",
              category: "api",
              severity: "error",
              message: "Unable to load dashboard.",
              platform: "ios"
            }
          ]
        })
      })
    )

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: "Too many mobile API requests. Please try again shortly."
    })
    expect(mockRequestErrorResponse).not.toHaveBeenCalled()
    expect(mockRecordDiagnosticEvents).not.toHaveBeenCalled()
  })
})
