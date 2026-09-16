import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const {
  mockRequireMobileAgent,
  mockCreateSupabaseAdminClient,
  mockGetAnalyticsSummary,
  mockListRecentLeads,
  mockRequestErrorResponse
} = vi.hoisted(() => ({
  mockRequireMobileAgent: vi.fn(),
  mockCreateSupabaseAdminClient: vi.fn(),
  mockGetAnalyticsSummary: vi.fn(),
  mockListRecentLeads: vi.fn(),
  mockRequestErrorResponse: vi.fn(async (input: {
    response: { error: string }
    status: number
  }) =>
    Response.json(input.response, {
      status: input.status,
      headers: {
        "x-request-id": "req-home"
      }
    })
  )
}))

vi.mock("@/lib/mobile-auth", () => ({
  MobileAuthError: class MobileAuthError extends Error {
    status: number
    headers?: HeadersInit

    constructor(status: number, message: string, headers?: HeadersInit) {
      super(message)
      this.status = status
      this.headers = headers
    }
  },
  requireMobileAgent: mockRequireMobileAgent
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

vi.mock("@/lib/supabase/data", () => ({
  getAnalyticsSummary: mockGetAnalyticsSummary,
  listRecentLeads: mockListRecentLeads
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

describe("GET /api/mobile/home", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockGetAnalyticsSummary.mockReset()
    mockListRecentLeads.mockReset()
    mockRequestErrorResponse.mockClear()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockGetAnalyticsSummary.mockResolvedValue({
      totalLeads: 12,
      newLeads: 3,
      readyToShow: 2,
      appointmentBooked: 1,
      nurture: 4,
      hold: 2,
      averageScore: 7.4
    })
    mockListRecentLeads.mockResolvedValue([])
  })

  it("loads dashboard summary and recent leads after one mobile auth pass", async () => {
    const response = await GET(
      new Request("http://localhost/api/mobile/home", {
        headers: {
          authorization: "Bearer token"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("server-timing")).toContain("auth")
    expect(response.headers.get("server-timing")).toContain("data")
    expect(mockRequireMobileAgent).toHaveBeenCalledTimes(1)
    expect(mockGetAnalyticsSummary).toHaveBeenCalledWith({ service: true }, "agent-1")
    expect(mockListRecentLeads).toHaveBeenCalledWith({}, "agent-1", 4)
    await expect(response.json()).resolves.toEqual({
      summary: {
        totalLeads: 12,
        newLeads: 3,
        readyToShow: 2,
        appointmentBooked: 1,
        nurture: 4,
        hold: 2,
        averageScore: 7.4
      },
      recentLeads: []
    })
  })

  it("logs data failures with the authenticated agent id", async () => {
    const error = new Error("database unavailable")
    mockGetAnalyticsSummary.mockRejectedValue(error)

    const response = await GET(
      new Request("http://localhost/api/mobile/home", {
        headers: {
          authorization: "Bearer token"
        }
      })
    )

    expect(response.status).toBe(400)
    expect(mockRequestErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        error,
        route: "api.mobile.home",
        status: 400,
        agentId: "agent-1",
        response: {
          error: "Unable to load home data."
        }
      })
    )
  })
})
