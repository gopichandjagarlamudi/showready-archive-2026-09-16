import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const {
  MockMobileAuthError,
  mockCreatePrivacyRequest,
  mockCreateSupabaseAdminClient,
  mockGetClientIp,
  mockRecordAuditEvents,
  mockRecordConsentRecords,
  mockRequestErrorResponse,
  mockRequireMobileAgent
} = vi.hoisted(() => {
  class MockMobileAuthError extends Error {
    status: number
    headers?: HeadersInit

    constructor(status: number, message: string, headers?: HeadersInit) {
      super(message)
      this.status = status
      this.headers = headers
    }
  }

  return {
    MockMobileAuthError,
    mockCreatePrivacyRequest: vi.fn(),
    mockCreateSupabaseAdminClient: vi.fn(),
    mockGetClientIp: vi.fn(),
    mockRecordAuditEvents: vi.fn(),
    mockRecordConsentRecords: vi.fn(),
    mockRequestErrorResponse: vi.fn(async (input: { response: { error: string }; status: number }) =>
      Response.json(input.response, {
        status: input.status,
        headers: {
          "x-request-id": "req-delete"
        }
      })
    ),
    mockRequireMobileAgent: vi.fn()
  }
})

vi.mock("@/lib/mobile-auth", () => ({
  MobileAuthError: MockMobileAuthError,
  requireMobileAgent: mockRequireMobileAgent
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: mockGetClientIp
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/supabase/data", () => ({
  createPrivacyRequest: mockCreatePrivacyRequest,
  recordAuditEvents: mockRecordAuditEvents,
  recordConsentRecords: mockRecordConsentRecords
}))

describe("POST /api/mobile/account-deletion", () => {
  beforeEach(() => {
    mockCreatePrivacyRequest.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockGetClientIp.mockReset()
    mockRecordAuditEvents.mockReset()
    mockRecordConsentRecords.mockReset()
    mockRequestErrorResponse.mockReset()
    mockRequireMobileAgent.mockReset()

    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockGetClientIp.mockReturnValue("203.0.113.10")
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: { scoped: true },
      user: {
        id: "agent-1",
        email: "agent@example.com"
      }
    })
    mockCreatePrivacyRequest.mockResolvedValue({
      id: "privacy-request-1"
    })
    mockRecordAuditEvents.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    mockRecordConsentRecords.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
  })

  it("records an authenticated account deletion request with consent and audit trails", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/account-deletion", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
          "user-agent": "ShowReady/1.0"
        },
        body: JSON.stringify({
          note: "Please delete my mobile account."
        })
      })
    )

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      requestId: "privacy-request-1"
    })
    expect(mockCreatePrivacyRequest).toHaveBeenCalledWith(
      { service: true },
      {
        agentId: "agent-1",
        requesterEmail: "agent@example.com",
        requestType: "account_deletion",
        source: "mobile-settings",
        note: "Please delete my mobile account.",
        metadata: {
          requestIp: "203.0.113.10",
          userAgent: "ShowReady/1.0"
        }
      }
    )
    expect(mockRecordConsentRecords).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      [
        expect.objectContaining({
          subjectType: "agent",
          subjectId: "agent-1",
          agentId: "agent-1",
          consentType: "data_delete",
          status: "requested",
          source: "mobile-settings",
          metadata: {
            requestId: "privacy-request-1",
            requestType: "account_deletion"
          }
        })
      ]
    )
    expect(mockRecordAuditEvents).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      [
        expect.objectContaining({
          action: "privacy.delete_requested",
          actorId: "agent-1",
          actorType: "agent",
          resourceType: "account",
          resourceId: "agent-1",
          requestIp: "203.0.113.10",
          userAgent: "ShowReady/1.0",
          metadata: {
            requestId: "privacy-request-1",
            requestType: "account_deletion"
          }
        })
      ]
    )
  })

  it("returns auth failures through the shared mobile error response", async () => {
    mockRequireMobileAgent.mockRejectedValue(new MockMobileAuthError(401, "Missing bearer token."))

    const response = await POST(
      new Request("http://localhost/api/mobile/account-deletion", {
        method: "POST",
        body: JSON.stringify({})
      })
    )

    expect(response.status).toBe(401)
    expect(response.headers.get("x-request-id")).toBe("req-delete")
    await expect(response.json()).resolves.toEqual({
      error: "Missing bearer token."
    })
  })
})
