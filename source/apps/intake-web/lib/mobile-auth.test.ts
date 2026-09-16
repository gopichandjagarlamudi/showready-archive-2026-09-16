import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockCreateSupabaseClient,
  mockCreateSupabaseAdminClient,
  mockEnsureAgentScaffold,
  mockGetSupabaseAnonKey,
  mockGetSupabaseUrl
} = vi.hoisted(() => ({
  mockCreateSupabaseClient: vi.fn(),
  mockCreateSupabaseAdminClient: vi.fn(),
  mockEnsureAgentScaffold: vi.fn(),
  mockGetSupabaseAnonKey: vi.fn(),
  mockGetSupabaseUrl: vi.fn()
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateSupabaseClient
}))

vi.mock("./supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("./supabase/data", () => ({
  ensureAgentScaffold: mockEnsureAgentScaffold
}))

vi.mock("./supabase/env", () => ({
  getSupabaseAnonKey: mockGetSupabaseAnonKey,
  getSupabaseUrl: mockGetSupabaseUrl
}))

describe("requireMobileAgent", () => {
  beforeEach(async () => {
    vi.resetModules()
    process.env.MOBILE_RATE_LIMIT_PRE_AUTH_PER_MINUTE = "2"
    process.env.MOBILE_RATE_LIMIT_USER_PER_MINUTE = "2"
    delete process.env.MOBILE_RATE_LIMIT_INVITES_PER_MINUTE
    mockCreateSupabaseClient.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockEnsureAgentScaffold.mockReset()
    mockGetSupabaseAnonKey.mockReturnValue("anon-key")
    mockGetSupabaseUrl.mockReturnValue("https://example.supabase.co")
    mockCreateSupabaseClient.mockReturnValue({ scoped: true })
    mockEnsureAgentScaffold.mockResolvedValue(undefined)
  })

  it("rate limits invalid bearer tokens before repeatedly calling Supabase auth", async () => {
    const { MobileAuthError, requireMobileAgent, resetMobileRateLimits } = await import("./mobile-auth")
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token")
    })
    mockCreateSupabaseAdminClient.mockReturnValue({
      auth: {
        getUser
      }
    })

    const request = () =>
      new Request("http://localhost/api/mobile/dashboard", {
        headers: {
          authorization: "Bearer invalid-token",
          "x-forwarded-for": "203.0.113.44"
        }
      })

    resetMobileRateLimits()
    await expect(requireMobileAgent(request())).rejects.toMatchObject({ status: 401 })
    await expect(requireMobileAgent(request())).rejects.toMatchObject({ status: 401 })

    try {
      await requireMobileAgent(request())
      throw new Error("Expected mobile auth rate limit.")
    } catch (error) {
      expect(error).toBeInstanceOf(MobileAuthError)
      expect(error).toMatchObject({
        status: 429,
        message: "Too many mobile API requests. Please try again shortly."
      })
      expect((error as InstanceType<typeof MobileAuthError>).headers).toEqual(
        expect.objectContaining({ "Retry-After": "60" })
      )
    }

    expect(getUser).toHaveBeenCalledTimes(2)
  })

  it("rate limits authenticated users after token validation", async () => {
    process.env.MOBILE_RATE_LIMIT_PRE_AUTH_PER_MINUTE = "10"
    process.env.MOBILE_RATE_LIMIT_INVITES_PER_MINUTE = "2"
    const { requireMobileAgent, resetMobileRateLimits } = await import("./mobile-auth")
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "agent-1", email: "agent@example.com", user_metadata: {} } },
      error: null
    })
    mockCreateSupabaseAdminClient.mockReturnValue({
      auth: {
        getUser
      }
    })

    const request = () =>
      new Request("http://localhost/api/mobile/invites", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "x-forwarded-for": "203.0.113.45"
        }
      })

    resetMobileRateLimits()
    await expect(requireMobileAgent(request())).resolves.toMatchObject({ agentId: "agent-1" })
    await expect(requireMobileAgent(request())).resolves.toMatchObject({ agentId: "agent-1" })
    await expect(requireMobileAgent(request())).rejects.toMatchObject({ status: 429 })
  })

  it("keeps pre-auth route limits isolated so diagnostics bursts do not block dashboard loads", async () => {
    process.env.MOBILE_RATE_LIMIT_PRE_AUTH_PER_MINUTE = "2"
    const { requireMobileAgent, resetMobileRateLimits } = await import("./mobile-auth")
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token")
    })
    mockCreateSupabaseAdminClient.mockReturnValue({
      auth: {
        getUser
      }
    })

    const request = (path: string, method = "GET") =>
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: "Bearer invalid-token",
          "x-forwarded-for": "203.0.113.47"
        }
      })

    resetMobileRateLimits()
    await expect(requireMobileAgent(request("/api/mobile/diagnostics", "POST"))).rejects.toMatchObject({
      status: 401
    })
    await expect(requireMobileAgent(request("/api/mobile/diagnostics", "POST"))).rejects.toMatchObject({
      status: 401
    })
    await expect(requireMobileAgent(request("/api/mobile/diagnostics", "POST"))).rejects.toMatchObject({
      status: 429
    })

    await expect(requireMobileAgent(request("/api/mobile/dashboard"))).rejects.toMatchObject({
      status: 401
    })
    expect(getUser).toHaveBeenCalledTimes(3)
  })

  it("caches completed agent scaffold checks across nearby requests", async () => {
    process.env.MOBILE_RATE_LIMIT_PRE_AUTH_PER_MINUTE = "10"
    process.env.MOBILE_RATE_LIMIT_USER_PER_MINUTE = "10"
    const { requireMobileAgent, resetMobileRateLimits } = await import("./mobile-auth")
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "agent-1", email: "agent@example.com", user_metadata: {} } },
      error: null
    })
    mockCreateSupabaseAdminClient.mockReturnValue({
      auth: {
        getUser
      }
    })

    const request = () =>
      new Request("http://localhost/api/mobile/dashboard", {
        headers: {
          authorization: "Bearer valid-token",
          "x-forwarded-for": "203.0.113.46"
        }
      })

    resetMobileRateLimits()
    await expect(requireMobileAgent(request())).resolves.toMatchObject({ agentId: "agent-1" })
    await expect(requireMobileAgent(request())).resolves.toMatchObject({ agentId: "agent-1" })

    expect(mockEnsureAgentScaffold).toHaveBeenCalledTimes(1)
  })
})
