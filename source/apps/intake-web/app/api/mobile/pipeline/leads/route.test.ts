import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const { mockRequireMobileAgent, mockCreateSupabaseAdminClient, mockListPipelineLeads } = vi.hoisted(() => ({
  mockRequireMobileAgent: vi.fn(),
  mockCreateSupabaseAdminClient: vi.fn(),
  mockListPipelineLeads: vi.fn()
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
  listPipelineLeads: mockListPipelineLeads
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

describe("GET /api/mobile/pipeline/leads", () => {
  beforeEach(() => {
    mockRequireMobileAgent.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockListPipelineLeads.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: {}
    })
    mockListPipelineLeads.mockResolvedValue({
      leads: [],
      total: 0,
      mode: "filtered_results",
      summaryLabel: "0 shown"
    })
  })

  it("passes normalized query params to the pipeline data loader", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/mobile/pipeline/leads?tab=active&category=nurture&query=Riley&submittedFrom=2026-04-22T04:00:00.000Z&submittedTo=2026-04-23T04:00:00.000Z&limit=100&offset=25",
        {
          headers: {
            authorization: "Bearer token"
          }
        }
      )
    )

    expect(response.status).toBe(200)
    expect(mockListPipelineLeads).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      expect.objectContaining({
        tab: "active",
        category: "nurture",
        query: "Riley",
        submittedFrom: "2026-04-22T04:00:00.000Z",
        submittedTo: "2026-04-23T04:00:00.000Z",
        limit: 50,
        offset: 25
      })
    )
  })
})
