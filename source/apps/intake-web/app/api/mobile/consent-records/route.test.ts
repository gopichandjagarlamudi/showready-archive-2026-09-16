import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const { mockCreateSupabaseAdminClient, mockRequireMobileAgent, mockRecordConsentRecords } = vi.hoisted(() => ({
  mockCreateSupabaseAdminClient: vi.fn(),
  mockRequireMobileAgent: vi.fn(),
  mockRecordConsentRecords: vi.fn()
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
  recordConsentRecords: mockRecordConsentRecords
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

describe("POST /api/mobile/consent-records", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockRecordConsentRecords.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockRecordConsentRecords.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
  })

  it("stores consent records for the authenticated agent and redacts metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/consent-records", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          records: [
            {
              id: "61ae65c3-f103-45c6-9a42-a9f5e1785b2f",
              subjectType: "agent",
              subjectId: "spoofed-agent",
              agentId: "spoofed-agent",
              consentType: "push_notifications",
              status: "granted",
              source: "mobile-session-provider",
              occurredAt: "2026-04-29T12:00:00.000Z",
              metadata: {
                permissionStatus: "granted",
                expoPushToken: "ExponentPushToken[secret]"
              }
            }
          ]
        })
      })
    )

    expect(response.status).toBe(202)
    expect(mockRecordConsentRecords).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      [
        expect.objectContaining({
          agentId: "agent-1",
          subjectId: "agent-1",
          metadata: {
            permissionStatus: "granted"
          }
        })
      ]
    )
  })
})
