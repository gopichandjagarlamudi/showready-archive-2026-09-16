import { beforeEach, describe, expect, it, vi } from "vitest"
import { DELETE, PATCH } from "./route"

const {
  mockRequireMobileAgent,
  mockCreateSupabaseAdminClient,
  mockDeleteLead,
  mockRequestErrorResponse,
  mockUpdateLeadContact
} = vi.hoisted(() => ({
  mockRequireMobileAgent: vi.fn(),
  mockCreateSupabaseAdminClient: vi.fn(),
  mockDeleteLead: vi.fn(),
  mockRequestErrorResponse: vi.fn(async (input: { response: { error: string }; status: number }) =>
    Response.json(input.response, { status: input.status })
  ),
  mockUpdateLeadContact: vi.fn()
}))

vi.mock("@/lib/mobile-auth", () => ({
  MobileAuthError: class MobileAuthError extends Error {
    status: number

    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
  requireMobileAgent: mockRequireMobileAgent
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/supabase/data", () => ({
  deleteLead: mockDeleteLead,
  getLeadById: vi.fn(),
  updateLeadContact: mockUpdateLeadContact
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

describe("/api/mobile/leads/[leadId]", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockDeleteLead.mockReset()
    mockRequestErrorResponse.mockReset()
    mockUpdateLeadContact.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockUpdateLeadContact.mockResolvedValue({
      id: "lead-1",
      agentId: "agent-1",
      intakeType: "sale",
      buyerName: "Updated Client",
      buyerEmail: "updated@example.com",
      token: "token-1",
      tokenExpiresAt: "2026-05-11T12:00:00.000Z",
      status: "submitted",
      pipelineStage: "new",
      createdAt: "2026-05-04T12:00:00.000Z",
      updatedAt: "2026-05-04T12:00:00.000Z"
    })
    mockDeleteLead.mockResolvedValue(true)
  })

  it("updates contact details only inside the authenticated agent scope", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/mobile/leads/lead-1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          buyerName: "Updated Client",
          buyerEmail: "updated@example.com",
          intakeType: "sale"
        })
      }),
      {
        params: Promise.resolve({ leadId: "lead-1" })
      }
    )

    expect(response.status).toBe(200)
    expect(mockUpdateLeadContact).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      "lead-1",
      {
        buyerName: "Updated Client",
        buyerEmail: "updated@example.com",
        intakeType: "sale"
      }
    )
    await expect(response.json()).resolves.toMatchObject({
      lead: {
        agentId: "agent-1",
        buyerName: "Updated Client"
      }
    })
  })

  it("returns not found when contact updates miss the authenticated agent scope", async () => {
    mockUpdateLeadContact.mockResolvedValueOnce(null)

    const response = await PATCH(
      new Request("http://localhost/api/mobile/leads/lead-2", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          buyerName: "Other Client",
          buyerEmail: "other@example.com",
          intakeType: "sale"
        })
      }),
      {
        params: Promise.resolve({ leadId: "lead-2" })
      }
    )

    expect(response.status).toBe(404)
  })

  it("deletes leads only inside the authenticated agent scope", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/mobile/leads/lead-1", {
        method: "DELETE",
        headers: {
          authorization: "Bearer token"
        }
      }),
      {
        params: Promise.resolve({ leadId: "lead-1" })
      }
    )

    expect(response.status).toBe(200)
    expect(mockDeleteLead).toHaveBeenCalledWith({ service: true }, "agent-1", "lead-1")
    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})
