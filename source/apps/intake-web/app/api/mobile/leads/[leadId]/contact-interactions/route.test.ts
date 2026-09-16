import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const {
  mockRequireMobileAgent,
  mockCreateSupabaseAdminClient,
  mockRecordLeadContactInteraction,
  mockRequestErrorResponse
} = vi.hoisted(() => ({
  mockRequireMobileAgent: vi.fn(),
  mockCreateSupabaseAdminClient: vi.fn(),
  mockRecordLeadContactInteraction: vi.fn(),
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
  recordLeadContactInteraction: mockRecordLeadContactInteraction
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

describe("POST /api/mobile/leads/[leadId]/contact-interactions", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockRecordLeadContactInteraction.mockReset()
    mockRequestErrorResponse.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockRecordLeadContactInteraction.mockResolvedValue({
      id: "interaction-1",
      leadId: "lead-1",
      agentId: "agent-1",
      method: "call",
      occurredAt: "2026-05-03T15:30:00.000Z"
    })
  })

  it("records a valid contact interaction for the authenticated agent", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/leads/lead-1/contact-interactions", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          method: "call"
        })
      }),
      {
        params: Promise.resolve({ leadId: "lead-1" })
      }
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      interaction: {
        id: "interaction-1",
        leadId: "lead-1",
        agentId: "agent-1",
        method: "call",
        occurredAt: "2026-05-03T15:30:00.000Z"
      }
    })
    expect(mockRecordLeadContactInteraction).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      "lead-1",
      "call"
    )
  })

  it("rejects contact interaction payloads with duplicated contact values", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/leads/lead-1/contact-interactions", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          method: "text",
          phone: "416-555-0101"
        })
      }),
      {
        params: Promise.resolve({ leadId: "lead-1" })
      }
    )

    expect(response.status).toBe(400)
    expect(mockRecordLeadContactInteraction).not.toHaveBeenCalled()
  })
})
