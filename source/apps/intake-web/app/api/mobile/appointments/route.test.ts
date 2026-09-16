import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const { mockRequireMobileAgent, mockListAppointments } = vi.hoisted(() => ({
  mockRequireMobileAgent: vi.fn(),
  mockListAppointments: vi.fn()
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
  createAppointment: vi.fn(),
  listAppointments: mockListAppointments,
  updateAppointment: vi.fn()
}))

describe("GET /api/mobile/appointments", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockListAppointments.mockReset()
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockListAppointments.mockResolvedValue({
      appointments: [],
      total: 0
    })
  })

  it("passes normalized paginated query params to the appointment data loader", async () => {
    const response = await GET(
      new Request("http://localhost/api/mobile/appointments?status=completed&limit=100&offset=25", {
        headers: {
          authorization: "Bearer token"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(mockListAppointments).toHaveBeenCalledWith(
      {},
      "agent-1",
      expect.objectContaining({
        status: "completed",
        limit: 50,
        offset: 25
      })
    )
    await expect(response.json()).resolves.toEqual({
      appointments: [],
      total: 0
    })
  })
})
