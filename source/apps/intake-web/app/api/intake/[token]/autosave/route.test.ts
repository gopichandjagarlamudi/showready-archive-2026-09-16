import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"
import { resetPublicIntakeRateLimits } from "@/lib/public-intake-guard"

const {
  mockAutosaveIntakeStep,
  mockCreateSupabaseAdminClient,
  mockAutosaveInviteDraft,
  mockRequestErrorResponse
} =
  vi.hoisted(() => ({
    mockAutosaveIntakeStep: vi.fn(),
    mockCreateSupabaseAdminClient: vi.fn(),
    mockAutosaveInviteDraft: vi.fn(),
    mockRequestErrorResponse: vi.fn(async (input: {
      response: { error: string }
      status: number
      headers?: HeadersInit
    }) =>
      Response.json(input.response, {
        status: input.status,
        headers: {
          ...(input.headers ?? {}),
          "x-request-id": "req-intake"
        }
      })
    )
  }))

vi.mock("@showready/application", () => ({
  autosaveIntakeStep: mockAutosaveIntakeStep
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/supabase/data", () => ({
  autosaveInviteDraft: mockAutosaveInviteDraft
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

describe("POST /api/intake/[token]/autosave", () => {
  beforeEach(() => {
    resetPublicIntakeRateLimits()
    mockCreateSupabaseAdminClient.mockClear()
    mockAutosaveIntakeStep.mockReset()
    mockAutosaveInviteDraft.mockReset()
    mockRequestErrorResponse.mockClear()
    mockCreateSupabaseAdminClient.mockReturnValue({ admin: true })
    mockAutosaveIntakeStep.mockImplementation(async (gateway, token, draft) => {
      return gateway.autosaveDraft(token, draft)
    })
    mockAutosaveInviteDraft.mockResolvedValue(undefined)
  })

  it("persists the draft through the application gateway", async () => {
    const draft = {
      contact: { fullName: "Taylor Verify", email: "taylor@example.com" },
      intent: "buy"
    }
    const response = await POST(
      new Request("http://localhost/api/intake/token/autosave", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ draft })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mockAutosaveInviteDraft).toHaveBeenCalledWith({ admin: true }, "invite-token", draft)
  })

  it("rejects non-json autosave requests before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/token/autosave", {
        method: "POST",
        headers: {
          "content-type": "text/plain"
        },
        body: "not json"
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(415)
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled()
    expect(mockRequestErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        route: "api.intake.autosave",
        status: 415,
        response: expect.objectContaining({
          error: expect.any(String)
        })
      })
    )
  })

  it("rejects honeypot autosave payloads before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/token/autosave", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: { contact: { fullName: "Taylor Verify" } },
          guard: {
            startedAt: Date.now() - 3000,
            website: "https://spam.example"
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(400)
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it("rejects unexpected draft fields before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/token/autosave", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: { fullName: "Taylor Verify" },
            intent: "buy",
            admin: true
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(400)
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it("logs rejected public intake validation without passing request body context", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/token/autosave", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: { fullName: "Taylor Verify", email: "taylor@example.com" },
            intent: "buy",
            admin: true
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("x-request-id")).toBe("req-intake")
    expect(mockRequestErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        route: "api.intake.autosave",
        status: 400,
        response: expect.objectContaining({
          error: expect.any(String)
        }),
        context: expect.not.objectContaining({
          body: expect.anything(),
          draft: expect.anything()
        })
      })
    )
  })
})
