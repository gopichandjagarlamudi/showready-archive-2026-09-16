import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const { mockCreateSupabaseAdminClient, mockRequireMobileAgent, mockRecordProductEvents, mockRequestErrorResponse } = vi.hoisted(() => ({
  mockCreateSupabaseAdminClient: vi.fn(),
  mockRequireMobileAgent: vi.fn(),
  mockRecordProductEvents: vi.fn(),
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
  recordProductEvents: mockRecordProductEvents
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

describe("POST /api/mobile/events", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockRecordProductEvents.mockReset()
    mockRequestErrorResponse.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockRecordProductEvents.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
  })

  it("stores valid product events for the authenticated agent and redacts blocked fields", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/events", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          events: [
            {
              id: "1d0bd5f6-51bd-4d65-a046-608c209f6c92",
              occurredAt: "2026-04-29T12:00:00.000Z",
              eventName: "lead.stage_changed",
              agentId: "spoofed-agent",
              actorId: "spoofed-agent",
              resourceType: "lead",
              resourceId: "lead-1",
              platform: "ios",
              properties: {
                fromStage: "new",
                toStage: "nurture",
                email: "buyer@example.com",
                authToken: "secret-token",
                nested: {
                  route: "/lead/lead-1",
                  phone: "416-555-0101"
                }
              }
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
    expect(mockRecordProductEvents).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      [
        expect.objectContaining({
          agentId: "agent-1",
          actorId: "agent-1",
          properties: {
            fromStage: "new",
            toStage: "nurture",
            nested: {
              route: "/lead/lead-1"
            }
          }
        })
      ]
    )
  })

  it("returns 400 for an empty product event batch", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/events", {
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
      error: "Product event batch must contain at least one event."
    })
    expect(mockRecordProductEvents).not.toHaveBeenCalled()
  })
})
