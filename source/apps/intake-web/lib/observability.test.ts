import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  captureServerError,
  captureClientError,
  captureRequestError,
  requestErrorResponse
} from "./observability"
import { captureNextRequestError } from "./observability-edge"

const { mockCreateSupabaseAdminClient, mockFrom, mockInsert } = vi.hoisted(() => ({
  mockCreateSupabaseAdminClient: vi.fn(),
  mockFrom: vi.fn(),
  mockInsert: vi.fn()
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

describe("request error observability", () => {
  beforeEach(() => {
    mockCreateSupabaseAdminClient.mockReset()
    mockFrom.mockReset()
    mockInsert.mockReset()
    mockInsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockCreateSupabaseAdminClient.mockReturnValue({ from: mockFrom })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("stores sanitized backend error details without request secrets", async () => {
    const error = new Error(
      "Unable to load buyer@example.com with Bearer production-secret-token"
    )
    error.stack =
      "Error: buyer@example.com failed\nAuthorization: Bearer production-secret-token"

    const result = await captureRequestError({
      request: new Request(
        "http://localhost/api/mobile/leads?query=buyer@example.com&phone=4165550101",
        {
          headers: {
            authorization: "Bearer request-secret",
            "x-request-id": "req-existing",
            "user-agent": "vitest"
          },
          body: JSON.stringify({
            email: "buyer@example.com",
            phone: "4165550101"
          }),
          method: "POST"
        }
      ),
      error,
      route: "api.mobile.leads",
      status: 500,
      agentId: "00000000-0000-0000-0000-000000000001",
      context: {
        safeFlag: "kept",
        email: "buyer@example.com",
        nested: {
          phone: "4165550101",
          stage: "ready_to_show"
        },
        headers: {
          authorization: "Bearer nested-secret"
        }
      }
    })

    expect(result.requestId).toBe("req-existing")
    expect(mockFrom).toHaveBeenCalledWith("server_error_events")
    expect(mockInsert).toHaveBeenCalledTimes(1)

    const row = mockInsert.mock.calls[0][0]
    expect(row).toMatchObject({
      agent_id: "00000000-0000-0000-0000-000000000001",
      request_id: "req-existing",
      route: "api.mobile.leads",
      method: "POST",
      path: "/api/mobile/leads",
      status: 500,
      error_type: "Error",
      query_keys: ["phone", "query"],
      context: {
        safeFlag: "kept",
        nested: {
          stage: "ready_to_show"
        }
      }
    })
    expect(row.message).toContain("[redacted-email]")
    expect(row.stack).toContain("[redacted-email]")
    expect(JSON.stringify(row)).not.toContain("buyer@example.com")
    expect(JSON.stringify(row)).not.toContain("4165550101")
    expect(JSON.stringify(row)).not.toContain("production-secret-token")
    expect(JSON.stringify(row)).not.toContain("request-secret")
    expect(JSON.stringify(row)).not.toContain("nested-secret")
  })

  it("normalizes dynamic ids and keeps logging failures from breaking responses", async () => {
    mockInsert.mockResolvedValue({ error: new Error("database unavailable") })

    const response = await requestErrorResponse({
      request: new Request(
        "http://localhost/api/intake/0c59f42d-ece8-4c07-a4ff-2358a0c1553f/autosave",
        {
          method: "POST"
        }
      ),
      error: new Error("Invalid draft"),
      route: "api.intake.autosave",
      status: 400,
      response: {
        error: "Unable to save answer."
      }
    })

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toMatch(/^req-/)
    await expect(response.json()).resolves.toEqual({
      error: "Unable to save answer."
    })

    const row = mockInsert.mock.calls[0][0]
    expect(row.path).toBe("/api/intake/:token/autosave")
  })

  it("stores sanitized browser runtime errors from the web app", async () => {
    const error = new Error("Browser crashed for buyer@example.com with token=secret-token")
    error.stack = "Error: buyer@example.com\nphone=4165550101"

    await captureClientError({
      request: new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: {
          "x-request-id": "req-browser"
        }
      }),
      error,
      route: "client.web",
      path: "/intake/invite-token?email=buyer@example.com&phone=4165550101",
      context: {
        eventType: "unhandledrejection",
        component: "IntakeFlow",
        token: "invite-token",
        email: "buyer@example.com"
      }
    })

    const row = mockInsert.mock.calls[0][0]
    expect(row).toMatchObject({
      request_id: "req-browser",
      route: "client.web",
      method: "CLIENT",
      path: "/intake/:token",
      status: 0,
      error_type: "Error",
      query_keys: ["email", "phone"],
      context: {
        eventType: "unhandledrejection",
        component: "IntakeFlow"
      }
    })
    expect(JSON.stringify(row)).not.toContain("buyer@example.com")
    expect(JSON.stringify(row)).not.toContain("4165550101")
    expect(JSON.stringify(row)).not.toContain("invite-token")
    expect(JSON.stringify(row)).not.toContain("secret-token")
  })

  it("logs uncaught Next request errors from the edge-safe instrumentation path", async () => {
    await captureNextRequestError(new Error("Server render failed for buyer@example.com"), {
      path: "/intake/invite-token?email=buyer@example.com",
      method: "GET",
      headers: {
        "x-request-id": "req-next"
      },
      context: {
        routerKind: "App Router",
        routePath: "/intake/[token]",
        routeType: "render",
        renderSource: "server-rendering",
        revalidateReason: undefined
      }
    })

    expect(mockInsert).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      "[showready:next.render./intake/[token]]",
      expect.objectContaining({
        requestId: "req-next",
        method: "GET",
        path: "/intake/:token",
        queryKeys: ["email"],
        message: "Server render failed for [redacted-email]",
        context: {
          routerKind: "App Router",
          routePath: "/intake/[token]",
          routeType: "render",
          renderSource: "server-rendering"
        }
      })
    )
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toContain(
      "buyer@example.com"
    )
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toContain(
      "invite-token"
    )
  })

  it("logs standalone server errors without raw sensitive values", () => {
    captureServerError(
      new Error("Unable to enqueue buyer@example.com with token=secret-token"),
      "api.intake.submit.outbox"
    )

    expect(console.error).toHaveBeenCalledWith(
      "[showready:api.intake.submit.outbox]",
      expect.objectContaining({
        errorType: "Error",
        message: "Unable to enqueue [redacted-email] with token=[redacted]"
      })
    )
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toContain(
      "buyer@example.com"
    )
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toContain(
      "secret-token"
    )
  })
})
