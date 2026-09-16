import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const { mockRequireMobileAgent, mockCreateInvite, mockGetAgentProfile } = vi.hoisted(() => ({
  mockRequireMobileAgent: vi.fn(),
  mockCreateInvite: vi.fn(),
  mockGetAgentProfile: vi.fn()
}))

vi.mock("@/lib/mobile-auth", () => ({
  mobileErrorResponse: (error: { message: string; status: number; headers?: HeadersInit }) =>
    Response.json({ error: error.message }, { status: error.status, headers: error.headers }),
  requireMobileAgent: mockRequireMobileAgent
}))

vi.mock("@/lib/supabase/data", () => ({
  createInvite: mockCreateInvite,
  getAgentProfile: mockGetAgentProfile
}))

describe("POST /api/mobile/invites", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockCreateInvite.mockResolvedValue({
      token: "invite-token",
      tokenExpiresAt: "2026-04-25T12:00:00.000+00:00"
    })
    mockGetAgentProfile.mockResolvedValue({
      fullName: "Jonathan"
    })
  })

  it("returns a shareable invite payload with a normalized expiry timestamp", async () => {
    const response = await POST(
      new Request("http://localhost/api/mobile/invites", {
        method: "POST",
        headers: {
          authorization: "Bearer token"
        }
      })
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      token: "invite-token",
      shareUrl: "http://localhost:3000/intake/invite-token",
      expiresAt: "2026-04-25T12:00:00.000Z",
      agentName: "Jonathan"
    })
  })

  it("uses the request origin when the configured app url is localhost", async () => {
    const response = await POST(
      new Request("http://192.168.5.13:3000/api/mobile/invites", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          host: "192.168.5.13:3000"
        }
      })
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      token: "invite-token",
      shareUrl: "http://192.168.5.13:3000/intake/invite-token",
      expiresAt: "2026-04-25T12:00:00.000Z",
      agentName: "Jonathan"
    })
  })
})
