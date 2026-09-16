import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const { mockCreateSupabaseAdminClient, mockRequireMobileAgent, mockRecordAgentFeedback, mockRequestErrorResponse } =
  vi.hoisted(() => ({
    mockCreateSupabaseAdminClient: vi.fn(),
    mockRequireMobileAgent: vi.fn(),
    mockRecordAgentFeedback: vi.fn(),
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
  recordAgentFeedback: mockRecordAgentFeedback
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

describe("POST /api/mobile/feedback", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockRecordAgentFeedback.mockReset()
    mockRequestErrorResponse.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockRecordAgentFeedback.mockResolvedValue({ ok: true })
  })

  it("stores valid feedback for the authenticated agent", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/feedback", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: "  Please add calendar sync for showings.  "
        })
      })
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mockRecordAgentFeedback).toHaveBeenCalledWith({ service: true }, "agent-1", {
      message: "Please add calendar sync for showings.",
      source: "mobile-settings"
    })
  })

  it("returns 400 for invalid feedback", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/feedback", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: "   "
        })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Feedback message is required."
    })
    expect(mockRecordAgentFeedback).not.toHaveBeenCalled()
  })
})
