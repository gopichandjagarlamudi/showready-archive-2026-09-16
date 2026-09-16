import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"
import { resetPublicIntakeRateLimits } from "@/lib/public-intake-guard"

const {
  mockSubmitIntakeDraft,
  mockCreateSupabaseAdminClient,
  mockSubmitInvite,
  mockEnqueueOutboxJobs,
  mockGetAgentContext,
  mockListAgentPushTokens,
  mockRecordProductEvents,
  mockSendLeadScoredEmail,
  mockSendLeadScoredPushNotifications,
  mockTrackServerEvent,
  mockCaptureServerError,
  mockRequestErrorResponse
} = vi.hoisted(() => ({
  mockSubmitIntakeDraft: vi.fn(),
  mockCreateSupabaseAdminClient: vi.fn(),
  mockSubmitInvite: vi.fn(),
  mockEnqueueOutboxJobs: vi.fn(),
  mockGetAgentContext: vi.fn(),
  mockListAgentPushTokens: vi.fn(),
  mockRecordProductEvents: vi.fn(),
  mockSendLeadScoredEmail: vi.fn(),
  mockSendLeadScoredPushNotifications: vi.fn(),
  mockTrackServerEvent: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockRequestErrorResponse: vi.fn(async (input: {
    response: { error: string }
    status: number
    headers?: HeadersInit
  }) =>
    Response.json(input.response, {
      status: input.status,
      headers: {
        ...(input.headers ?? {}),
        "x-request-id": "req-submit"
      }
    })
  )
}))

vi.mock("@showready/application", () => ({
  submitIntakeDraft: mockSubmitIntakeDraft
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/supabase/data", () => ({
  submitInvite: mockSubmitInvite,
  enqueueOutboxJobs: mockEnqueueOutboxJobs,
  getAgentContext: mockGetAgentContext,
  listAgentPushTokens: mockListAgentPushTokens,
  recordProductEvents: mockRecordProductEvents
}))

vi.mock("@/lib/notifications", () => ({
  sendLeadScoredEmail: mockSendLeadScoredEmail,
  sendLeadScoredPushNotifications: mockSendLeadScoredPushNotifications
}))

vi.mock("@/lib/analytics", () => ({
  trackServerEvent: mockTrackServerEvent
}))

vi.mock("@/lib/observability", () => ({
  captureServerError: mockCaptureServerError,
  requestErrorResponse: mockRequestErrorResponse
}))

describe("POST /api/intake/[token]/submit", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
    resetPublicIntakeRateLimits()
    mockCreateSupabaseAdminClient.mockReset()
    mockSubmitIntakeDraft.mockReset()
    mockSubmitInvite.mockReset()
    mockEnqueueOutboxJobs.mockReset()
    mockGetAgentContext.mockReset()
    mockListAgentPushTokens.mockReset()
    mockRecordProductEvents.mockReset()
    mockSendLeadScoredEmail.mockReset()
    mockSendLeadScoredPushNotifications.mockReset()
    mockTrackServerEvent.mockReset()
    mockCaptureServerError.mockReset()
    mockRequestErrorResponse.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ admin: true })
    mockSubmitIntakeDraft.mockImplementation(async (gateway, token, draft) => {
      return gateway.submitDraft(token, draft)
    })
    mockSubmitInvite.mockResolvedValue({
      lead: {
        id: "lead-1",
        agentId: "agent-1",
        buyerName: "Taylor Verify",
        recommendation: "show",
        score: 8.9
      }
    })
    mockEnqueueOutboxJobs.mockResolvedValue([])
    mockGetAgentContext.mockResolvedValue({
      agent: {
        email: "agent@showready.local",
        fullName: "Demo Agent"
      },
      settings: {
        emailNotificationsEnabled: true
      }
    })
    mockListAgentPushTokens.mockResolvedValue(["ExponentPushToken[abc123]"])
    mockRecordProductEvents.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    mockSendLeadScoredEmail.mockResolvedValue(undefined)
    mockSendLeadScoredPushNotifications.mockResolvedValue(undefined)
    mockTrackServerEvent.mockResolvedValue(undefined)
  })

  it("submits the intake and enqueues non-critical side effects", async () => {
    const draft = {
      contact: {
        fullName: "Taylor Verify",
        email: "taylor@example.com",
        phone: "416-555-0101"
      },
      intent: "buy",
      buyer: {
        buyingFor: "myself",
        timeline: "within_1_month",
        budgetKnowledge: "know_it",
        mortgageStatus: "pre_approved",
        neighborhoods: "Toronto",
        propertyType: ["condo"]
      }
    }
    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ draft })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      lead: {
        id: "lead-1",
        agentId: "agent-1",
        buyerName: "Taylor Verify",
        recommendation: "show",
        score: 8.9
      }
    })
    expect(mockSubmitInvite).toHaveBeenCalledWith({ admin: true }, "invite-token", { draft })
    expect(mockEnqueueOutboxJobs).toHaveBeenCalledWith(
      { admin: true },
      "agent-1",
      [
        {
          jobType: "intake.submitted.product_event",
          resourceType: "lead",
          resourceId: "lead-1",
          payload: {
            recommendation: "show",
            scoreBand: "high"
          }
        },
        {
          jobType: "intake.submitted.push_notifications",
          resourceType: "lead",
          resourceId: "lead-1",
          payload: {
            title: "New lead submitted",
            body: "Taylor Verify just submitted the intake form.",
            route: "/(app)/new-leads"
          }
        },
        {
          jobType: "intake.submitted.email",
          resourceType: "lead",
          resourceId: "lead-1",
          payload: {
            detailUrl: "http://localhost:3000/leads/lead-1"
          }
        },
        {
          jobType: "intake.submitted.analytics",
          resourceType: "lead",
          resourceId: "lead-1",
          payload: {
            recommendation: "show"
          }
        }
      ]
    )
    expect(mockListAgentPushTokens).not.toHaveBeenCalled()
    expect(mockSendLeadScoredPushNotifications).not.toHaveBeenCalled()
    expect(mockSendLeadScoredEmail).not.toHaveBeenCalled()
    expect(mockTrackServerEvent).not.toHaveBeenCalled()
    expect(mockRecordProductEvents).not.toHaveBeenCalled()
  })

  it("still returns the submitted lead when outbox enqueueing is unavailable", async () => {
    const enqueueError = new Error("Outbox unavailable")
    mockEnqueueOutboxJobs.mockRejectedValueOnce(enqueueError)

    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: {
              fullName: "Taylor Verify",
              email: "taylor@example.com"
            },
            intent: "buy"
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      lead: {
        id: "lead-1",
        agentId: "agent-1",
        buyerName: "Taylor Verify",
        recommendation: "show",
        score: 8.9
      }
    })
    expect(mockCaptureServerError).toHaveBeenCalledWith(enqueueError, "api.intake.submit.outbox")
  })

  it("does not fetch notification inputs on the submit request path", async () => {
    mockGetAgentContext.mockResolvedValue({
      agent: {
        email: "agent@showready.local",
        fullName: "Demo Agent"
      },
      settings: {
        emailNotificationsEnabled: false
      }
    })

    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: {
              fullName: "Taylor Verify"
            }
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(200)
    expect(mockEnqueueOutboxJobs).toHaveBeenCalledOnce()
    expect(mockGetAgentContext).not.toHaveBeenCalled()
    expect(mockListAgentPushTokens).not.toHaveBeenCalled()
    expect(mockSendLeadScoredPushNotifications).not.toHaveBeenCalled()
    expect(mockSendLeadScoredEmail).not.toHaveBeenCalled()
  })

  it("still returns success without sending push notifications inline", async () => {
    mockSendLeadScoredPushNotifications.mockRejectedValueOnce(new Error("Expo unavailable"))

    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: {
              fullName: "Taylor Verify",
              email: "taylor@example.com"
            },
            intent: "buy"
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      lead: {
        id: "lead-1",
        agentId: "agent-1",
        buyerName: "Taylor Verify",
        recommendation: "show",
        score: 8.9
      }
    })
    expect(mockSendLeadScoredPushNotifications).not.toHaveBeenCalled()
    expect(mockCaptureServerError).not.toHaveBeenCalled()
  })

  it("still returns success without sending email inline", async () => {
    mockSendLeadScoredEmail.mockRejectedValueOnce(new Error("Email unavailable"))

    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: {
              fullName: "Taylor Verify",
              email: "taylor@example.com"
            },
            intent: "buy"
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      lead: {
        id: "lead-1",
        agentId: "agent-1",
        buyerName: "Taylor Verify",
        recommendation: "show",
        score: 8.9
      }
    })
    expect(mockSendLeadScoredEmail).not.toHaveBeenCalled()
    expect(mockCaptureServerError).not.toHaveBeenCalled()
  })

  it("still returns success without tracking analytics inline", async () => {
    mockTrackServerEvent.mockRejectedValueOnce(new Error("Analytics unavailable"))

    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: {
              fullName: "Taylor Verify",
              email: "taylor@example.com"
            },
            intent: "buy"
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      lead: {
        id: "lead-1",
        agentId: "agent-1",
        buyerName: "Taylor Verify",
        recommendation: "show",
        score: 8.9
      }
    })
    expect(mockTrackServerEvent).not.toHaveBeenCalled()
    expect(mockCaptureServerError).not.toHaveBeenCalled()
  })

  it("rejects oversized submit requests before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "70000"
        },
        body: "{}"
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(413)
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it("rejects unrealistically fast submit payloads before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: { contact: { fullName: "Taylor Verify" } },
          guard: {
            startedAt: Date.now() - 500,
            website: ""
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(400)
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it("rejects invalid enum answers before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: { fullName: "Taylor Verify", email: "taylor@example.com" },
            intent: "buy",
            buyer: {
              buyingFor: "flipping_houses",
              timeline: "within_1_month",
              budgetKnowledge: "know_it",
              mortgageStatus: "pre_approved",
              neighborhoods: "Toronto",
              propertyType: ["condo"]
            }
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(400)
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it("rejects invalid phone values before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          draft: {
            contact: {
              fullName: "Taylor Verify",
              phone: "call me<script>"
            },
            intent: "buy",
            buyer: {
              buyingFor: "myself",
              timeline: "within_1_month",
              budgetKnowledge: "know_it",
              mortgageStatus: "pre_approved",
              neighborhoods: "Toronto",
              propertyType: ["condo"]
            }
          }
        })
      }),
      { params: Promise.resolve({ token: "invite-token" }) }
    )

    expect(response.status).toBe(400)
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled()
  })
})
