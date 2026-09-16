import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const {
  mockCreateSupabaseAdminClient,
  mockClaimOutboxJobs,
  mockClaimRelatedPushNotificationJobs,
  mockCompleteOutboxJob,
  mockFailOutboxJob,
  mockGetAgentContext,
  mockGetLeadById,
  mockListAgentPushTokens,
  mockRecordProductEvents,
  mockSendLeadScoredEmail,
  mockSendLeadScoredPushNotifications,
  mockTrackServerEvent,
  mockCaptureServerError,
  mockRequestErrorResponse
} = vi.hoisted(() => ({
  mockCreateSupabaseAdminClient: vi.fn(),
  mockClaimOutboxJobs: vi.fn(),
  mockClaimRelatedPushNotificationJobs: vi.fn(),
  mockCompleteOutboxJob: vi.fn(),
  mockFailOutboxJob: vi.fn(),
  mockGetAgentContext: vi.fn(),
  mockGetLeadById: vi.fn(),
  mockListAgentPushTokens: vi.fn(),
  mockRecordProductEvents: vi.fn(),
  mockSendLeadScoredEmail: vi.fn(),
  mockSendLeadScoredPushNotifications: vi.fn(),
  mockTrackServerEvent: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockRequestErrorResponse: vi.fn(async (input: {
    response: { error: string }
    status: number
  }) => Response.json(input.response, { status: input.status }))
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/supabase/data", () => ({
  claimOutboxJobs: mockClaimOutboxJobs,
  claimRelatedPushNotificationJobs: mockClaimRelatedPushNotificationJobs,
  completeOutboxJob: mockCompleteOutboxJob,
  failOutboxJob: mockFailOutboxJob,
  getAgentContext: mockGetAgentContext,
  getLeadById: mockGetLeadById,
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

function makePushJob(id: string, agentId = "agent-1") {
  return {
    id,
    agentId,
    jobType: "intake.submitted.push_notifications",
    resourceType: "lead",
    resourceId: `lead-${id}`,
    payload: {
      title: "New lead submitted",
      body: `Buyer ${id} just submitted the intake form.`,
      route: "/(app)/new-leads"
    },
    status: "processing",
    attemptCount: 1,
    maxAttempts: 5
  }
}

describe("GET /api/jobs/outbox", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret"
    delete process.env.JOB_PROCESSOR_TOKEN
    mockCreateSupabaseAdminClient.mockReset()
    mockClaimOutboxJobs.mockReset()
    mockClaimRelatedPushNotificationJobs.mockReset()
    mockCompleteOutboxJob.mockReset()
    mockFailOutboxJob.mockReset()
    mockGetAgentContext.mockReset()
    mockGetLeadById.mockReset()
    mockListAgentPushTokens.mockReset()
    mockRecordProductEvents.mockReset()
    mockSendLeadScoredEmail.mockReset()
    mockSendLeadScoredPushNotifications.mockReset()
    mockTrackServerEvent.mockReset()
    mockCaptureServerError.mockReset()
    mockRequestErrorResponse.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ admin: true })
    mockClaimOutboxJobs.mockResolvedValue([])
    mockClaimRelatedPushNotificationJobs.mockResolvedValue([])
  })

  it("accepts Vercel cron GET requests and drains a bounded outbox batch", async () => {
    const response = await GET(
      new Request("http://localhost/api/jobs/outbox", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(mockClaimOutboxJobs).toHaveBeenCalledWith({ admin: true }, 10)
    await expect(response.json()).resolves.toEqual({
      claimed: 0,
      processed: 0,
      failed: 0
    })
  })

  it("rejects unauthenticated cron requests", async () => {
    const response = await GET(new Request("http://localhost/api/jobs/outbox"))

    expect(response.status).toBe(401)
    expect(mockClaimOutboxJobs).not.toHaveBeenCalled()
  })

  it("collapses more than three pending push jobs for one agent into one summary notification", async () => {
    const initialJob = makePushJob("1")
    const relatedJobs = [
      makePushJob("2"),
      makePushJob("3"),
      makePushJob("4"),
      makePushJob("5")
    ]
    mockClaimOutboxJobs.mockResolvedValue([initialJob])
    mockClaimRelatedPushNotificationJobs.mockResolvedValue(relatedJobs)
    mockListAgentPushTokens.mockResolvedValue(["ExponentPushToken[abc123]"])
    mockSendLeadScoredPushNotifications.mockResolvedValue({ skipped: false, sent: 1 })

    const response = await GET(
      new Request("http://localhost/api/jobs/outbox", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(mockClaimRelatedPushNotificationJobs).toHaveBeenCalledWith(
      { admin: true },
      "agent-1",
      ["1"],
      49
    )
    expect(mockSendLeadScoredPushNotifications).toHaveBeenCalledTimes(1)
    expect(mockSendLeadScoredPushNotifications).toHaveBeenCalledWith({
      expoPushTokens: ["ExponentPushToken[abc123]"],
      title: "5 new leads submitted",
      body: "Open ShowReady to review the latest intake submissions.",
      data: {
        route: "/(app)/new-leads",
        submissionCount: 5
      }
    })
    expect(mockGetLeadById).not.toHaveBeenCalled()
    expect(mockCompleteOutboxJob).toHaveBeenCalledTimes(5)
    for (const job of [initialJob, ...relatedJobs]) {
      expect(mockCompleteOutboxJob).toHaveBeenCalledWith({ admin: true }, job.id)
    }
    await expect(response.json()).resolves.toEqual({
      claimed: 1,
      processed: 5,
      failed: 0
    })
  })

  it("keeps three or fewer pending push jobs as individual lead notifications", async () => {
    const initialJob = makePushJob("1")
    const relatedJobs = [makePushJob("2"), makePushJob("3")]
    mockClaimOutboxJobs.mockResolvedValue([initialJob])
    mockClaimRelatedPushNotificationJobs.mockResolvedValue(relatedJobs)
    mockListAgentPushTokens.mockResolvedValue(["ExponentPushToken[abc123]"])
    mockGetLeadById.mockImplementation(async (_client, _agentId, leadId) => ({
      id: leadId,
      buyerName: `Buyer ${leadId}`,
      recommendation: "show",
      score: 9
    }))
    mockSendLeadScoredPushNotifications.mockResolvedValue({ skipped: false, sent: 1 })

    const response = await GET(
      new Request("http://localhost/api/jobs/outbox", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(mockSendLeadScoredPushNotifications).toHaveBeenCalledTimes(3)
    expect(mockSendLeadScoredPushNotifications).toHaveBeenNthCalledWith(1, {
      expoPushTokens: ["ExponentPushToken[abc123]"],
      title: "New lead submitted",
      body: "Buyer 1 just submitted the intake form.",
      data: {
        leadId: "lead-1",
        route: "/(app)/new-leads"
      }
    })
    expect(mockCompleteOutboxJob).toHaveBeenCalledTimes(3)
    await expect(response.json()).resolves.toEqual({
      claimed: 1,
      processed: 3,
      failed: 0
    })
  })
})
