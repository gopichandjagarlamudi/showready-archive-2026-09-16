import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const { mockCreateSupabaseAdminClient, mockRequireMobileAgent, mockRecordAuditEvents } = vi.hoisted(() => ({
  mockCreateSupabaseAdminClient: vi.fn(),
  mockRequireMobileAgent: vi.fn(),
  mockRecordAuditEvents: vi.fn()
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
  recordAuditEvents: mockRecordAuditEvents
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

describe("POST /api/mobile/audit-events", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockRecordAuditEvents.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockRecordAuditEvents.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
  })

  it("stores audit events with authenticated actor identity and sanitized summaries", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/audit-events", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
          "user-agent": "ShowReadyTest/1.0",
          "x-forwarded-for": "203.0.113.10"
        },
        body: JSON.stringify({
          events: [
            {
              id: "ab831397-3813-44ca-8495-0e778f8a1aa0",
              occurredAt: "2026-04-29T12:00:00.000Z",
              action: "lead.score_overridden",
              actorType: "agent",
              actorId: "spoofed-agent",
              agentId: "spoofed-agent",
              resourceType: "lead",
              resourceId: "lead-1",
              beforeSummary: {
                scoreBand: "medium",
                notes: "private note"
              },
              afterSummary: {
                scoreBand: "high",
                phone: "416-555-0101"
              }
            }
          ]
        })
      })
    )

    expect(response.status).toBe(202)
    expect(mockRecordAuditEvents).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      [
        expect.objectContaining({
          agentId: "agent-1",
          actorId: "agent-1",
          requestIp: "203.0.113.10",
          userAgent: "ShowReadyTest/1.0",
          beforeSummary: {
            scoreBand: "medium"
          },
          afterSummary: {
            scoreBand: "high"
          }
        })
      ]
    )
  })
})
