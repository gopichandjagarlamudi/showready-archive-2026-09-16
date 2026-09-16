import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const {
  mockRequireMobileAgent,
  mockListAppointments,
  mockListAppointmentEligibleLeadSuggestions,
  mockRequestErrorResponse
} = vi.hoisted(() => ({
  mockRequireMobileAgent: vi.fn(),
  mockListAppointments: vi.fn(),
  mockListAppointmentEligibleLeadSuggestions: vi.fn(),
  mockRequestErrorResponse: vi.fn(async (input: {
    response: { error: string }
    status: number
  }) =>
    Response.json(input.response, {
      status: input.status,
      headers: {
        "x-request-id": "req-appointments-initial"
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
  listAppointments: mockListAppointments,
  listAppointmentEligibleLeadSuggestions: mockListAppointmentEligibleLeadSuggestions
}))

describe("GET /api/mobile/appointments/initial", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockListAppointments.mockReset()
    mockListAppointmentEligibleLeadSuggestions.mockReset()
    mockRequestErrorResponse.mockClear()
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockListAppointments.mockResolvedValue({
      appointments: [],
      total: 0
    })
    mockListAppointmentEligibleLeadSuggestions.mockResolvedValue([])
  })

  it("loads appointments and eligible lead suggestions after one mobile auth pass", async () => {
    const response = await GET(
      new Request("http://localhost/api/mobile/appointments/initial?status=completed&limit=100&offset=25&leadLimit=20", {
        headers: {
          authorization: "Bearer token"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("server-timing")).toContain("auth")
    expect(response.headers.get("server-timing")).toContain("data")
    expect(mockRequireMobileAgent).toHaveBeenCalledTimes(1)
    expect(mockListAppointments).toHaveBeenCalledWith(
      {},
      "agent-1",
      expect.objectContaining({
        status: "completed",
        limit: 50,
        offset: 25
      })
    )
    expect(mockListAppointmentEligibleLeadSuggestions).toHaveBeenCalledWith(
      {},
      "agent-1",
      10
    )
    await expect(response.json()).resolves.toEqual({
      appointments: {
        appointments: [],
        total: 0
      },
      eligibleLeads: []
    })
  })

  it("logs failures with the authenticated agent id", async () => {
    const error = new Error("database unavailable")
    mockListAppointments.mockRejectedValue(error)

    const response = await GET(
      new Request("http://localhost/api/mobile/appointments/initial", {
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
        route: "api.mobile.appointments.initial",
        status: 400,
        agentId: "agent-1",
        response: {
          error: "Unable to load appointment data."
        }
      })
    )
  })
})
