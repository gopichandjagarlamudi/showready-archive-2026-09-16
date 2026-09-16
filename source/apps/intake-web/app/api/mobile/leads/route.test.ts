import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET, POST } from "./route"

const {
  MockMobileAuthError,
  mockRequireMobileAgent,
  mockCreateSupabaseAdminClient,
  mockCreateManualLead,
  mockListLeads,
  mockRequestErrorResponse
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
    mockRequireMobileAgent: vi.fn(),
    mockCreateSupabaseAdminClient: vi.fn(),
    mockCreateManualLead: vi.fn(),
    mockListLeads: vi.fn(),
    mockRequestErrorResponse: vi.fn(async (input: {
      response: { error: string }
      status: number
    }) =>
      Response.json(input.response, {
        status: input.status,
        headers: {
          "x-request-id": "req-route"
        }
      })
    )
  }
})

vi.mock("@/lib/mobile-auth", () => ({
  MobileAuthError: MockMobileAuthError,
  mobileErrorResponse: (error: { message: string; status: number; headers?: HeadersInit }) =>
    Response.json({ error: error.message }, { status: error.status, headers: error.headers }),
  requireMobileAgent: mockRequireMobileAgent
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

vi.mock("@/lib/supabase/data", () => ({
  createManualLead: mockCreateManualLead,
  listLeads: mockListLeads
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

describe("GET /api/mobile/leads", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockCreateManualLead.mockReset()
    mockListLeads.mockReset()
    mockRequestErrorResponse.mockClear()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockListLeads.mockResolvedValue({
      leads: [],
      total: 0
    })
  })

  it("creates manual leads for the authenticated mobile agent", async () => {
    mockCreateManualLead.mockResolvedValue({
      id: "lead-1",
      agentId: "agent-1",
      intakeType: "sale",
      buyerName: "Manual Client",
      buyerEmail: "manual@example.com",
      token: "token-1",
      tokenExpiresAt: "2026-05-11T12:00:00.000Z",
      status: "submitted",
      pipelineStage: "new",
      createdAt: "2026-05-04T12:00:00.000Z",
      updatedAt: "2026-05-04T12:00:00.000Z"
    })

    const response = await POST(
      new Request("http://localhost/api/mobile/leads", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          buyerName: "Manual Client",
          buyerEmail: "manual@example.com",
          intakeType: "sale"
        })
      })
    )

    expect(response.status).toBe(201)
    expect(mockCreateManualLead).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      {
        buyerName: "Manual Client",
        buyerEmail: "manual@example.com",
        intakeType: "sale"
      }
    )
    await expect(response.json()).resolves.toMatchObject({
      lead: {
        id: "lead-1",
        agentId: "agent-1"
      }
    })
  })

  it("rejects manual leads without an email or phone contact method", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/leads", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          buyerName: "Manual Client",
          intakeType: "sale"
        })
      })
    )

    expect(response.status).toBe(400)
    expect(mockCreateManualLead).not.toHaveBeenCalled()
  })

  it("passes normalized paginated query params to the lead data loader", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/mobile/leads?scope=appointment_eligible&query=Riley&limit=100&offset=25",
        {
          headers: {
            authorization: "Bearer token"
          }
        }
      )
    )

    expect(response.status).toBe(200)
    expect(mockListLeads).toHaveBeenCalledWith(
      {},
      "agent-1",
      expect.objectContaining({
        scope: "appointment_eligible",
        query: "Riley",
        limit: 50,
        offset: 25
      })
    )
    await expect(response.json()).resolves.toEqual({
      leads: [],
      total: 0
    })
  })

  it("logs mobile auth failures before returning the error response", async () => {
    const error = new MockMobileAuthError(401, "Missing bearer token.")
    mockRequireMobileAgent.mockRejectedValue(error)

    const response = await GET(new Request("http://localhost/api/mobile/leads"))

    expect(response.status).toBe(401)
    expect(response.headers.get("x-request-id")).toBe("req-route")
    await expect(response.json()).resolves.toEqual({
      error: "Missing bearer token."
    })
    expect(mockRequestErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        error,
        route: "api.mobile.leads",
        status: 401,
        response: {
          error: "Missing bearer token."
        }
      })
    )
  })

  it("logs data-layer failures with the authenticated agent id", async () => {
    const error = new Error("database unavailable")
    mockListLeads.mockRejectedValue(error)

    const response = await GET(
      new Request("http://localhost/api/mobile/leads?query=buyer@example.com", {
        headers: {
          authorization: "Bearer token"
        }
      })
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBe("req-route")
    await expect(response.json()).resolves.toEqual({
      error: "Unable to load leads."
    })
    expect(mockRequestErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        error,
        route: "api.mobile.leads",
        status: 400,
        agentId: "agent-1",
        response: {
          error: "Unable to load leads."
        }
      })
    )
  })
})
