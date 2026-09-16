import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const {
  mockCaptureClientError,
  mockConsumeRateLimit,
  mockGetClientIp,
  mockGetDefaultRateLimitStore
} = vi.hoisted(() => ({
  mockCaptureClientError: vi.fn(),
  mockConsumeRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockGetDefaultRateLimitStore: vi.fn()
}))

vi.mock("@/lib/observability", () => ({
  captureClientError: mockCaptureClientError
}))

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mockConsumeRateLimit,
  getClientIp: mockGetClientIp,
  getDefaultRateLimitStore: mockGetDefaultRateLimitStore
}))

describe("POST /api/client-errors", () => {
  beforeEach(() => {
    mockCaptureClientError.mockReset()
    mockConsumeRateLimit.mockReset()
    mockGetClientIp.mockReset()
    mockGetDefaultRateLimitStore.mockReset()

    mockGetClientIp.mockReturnValue("203.0.113.10")
    mockGetDefaultRateLimitStore.mockReturnValue("rate-limit-store")
    mockConsumeRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetAt: Date.now() + 60000,
      retryAfterSeconds: 60,
      headers: {}
    })
    mockCaptureClientError.mockResolvedValue({ requestId: "req-client" })
  })

  it("captures sanitized web client runtime errors without failing the browser report", async () => {
    const response = await POST(
      new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-browser"
        },
        body: JSON.stringify({
          eventType: "unhandledrejection",
          name: "TypeError",
          message: "Cannot read properties of undefined",
          stack: "TypeError: Cannot read properties of undefined",
          path: "/intake/invite-token?email=buyer@example.com",
          source: "webpack://showready/components/intake-flow.tsx",
          line: 42,
          column: 7
        })
      })
    )

    expect(response.status).toBe(204)
    expect(mockCaptureClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        route: "client.web",
        path: "/intake/invite-token?email=buyer@example.com",
        context: {
          eventType: "unhandledrejection",
          source: "webpack://showready/components/intake-flow.tsx",
          line: 42,
          column: 7
        }
      })
    )
    expect(mockCaptureClientError.mock.calls[0][0].error).toMatchObject({
      name: "TypeError",
      message: "Cannot read properties of undefined"
    })
  })

  it("silently drops client error reports after the telemetry rate limit", async () => {
    mockConsumeRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      retryAfterSeconds: 60,
      headers: {}
    })

    const response = await POST(
      new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: "Repeated client error",
          path: "/intake/invite-token"
        })
      })
    )

    expect(response.status).toBe(204)
    expect(mockCaptureClientError).not.toHaveBeenCalled()
  })
})
