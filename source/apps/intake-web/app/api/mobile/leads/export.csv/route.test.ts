import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const {
  MockMobileAuthError,
  mockBuildLeadExportCsv,
  mockCreateSupabaseAdminClient,
  mockGetAgentContext,
  mockGetClientIp,
  mockListSubmittedLeadsForCsvExport,
  mockRecordAuditEvents,
  mockRequestErrorResponse,
  mockRequireMobileAgent
} = vi.hoisted(() => {
  class MockMobileAuthError extends Error {
    status: number
    headers?: HeadersInit

    constructor(status: number, message: string, headers?: HeadersInit) {
      super(message)
      this.status = status
      this.headers = headers
    }
  }

  return {
    MockMobileAuthError,
    mockBuildLeadExportCsv: vi.fn(),
    mockCreateSupabaseAdminClient: vi.fn(),
    mockGetAgentContext: vi.fn(),
    mockGetClientIp: vi.fn(),
    mockListSubmittedLeadsForCsvExport: vi.fn(),
    mockRecordAuditEvents: vi.fn(),
    mockRequestErrorResponse: vi.fn(async (input: { response: { error: string }; status: number }) =>
      Response.json(input.response, {
        status: input.status,
        headers: {
          "x-request-id": "req-export"
        }
      })
    ),
    mockRequireMobileAgent: vi.fn()
  }
})

vi.mock("@/lib/mobile-auth", () => ({
  MobileAuthError: MockMobileAuthError,
  requireMobileAgent: mockRequireMobileAgent
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: mockGetClientIp
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/supabase/data", () => ({
  getAgentContext: mockGetAgentContext,
  listSubmittedLeadsForCsvExport: mockListSubmittedLeadsForCsvExport,
  recordAuditEvents: mockRecordAuditEvents
}))

vi.mock("@/lib/leads/export-csv", () => ({
  buildLeadExportCsv: mockBuildLeadExportCsv
}))

describe("GET /api/mobile/leads/export.csv", () => {
  beforeEach(() => {
    mockBuildLeadExportCsv.mockReset()
    mockCreateSupabaseAdminClient.mockReset()
    mockGetAgentContext.mockReset()
    mockGetClientIp.mockReset()
    mockListSubmittedLeadsForCsvExport.mockReset()
    mockRecordAuditEvents.mockReset()
    mockRequestErrorResponse.mockReset()
    mockRequireMobileAgent.mockReset()

    mockRequireMobileAgent.mockResolvedValue({
      agentId: "agent-1",
      client: { scoped: true },
      user: {
        id: "agent-1"
      }
    })
    mockCreateSupabaseAdminClient.mockReturnValue({ service: true })
    mockGetAgentContext.mockResolvedValue({
      agent: {
        fullName: "Demo Agent"
      }
    })
    mockGetClientIp.mockReturnValue("203.0.113.10")
    mockListSubmittedLeadsForCsvExport.mockResolvedValue([
      {
        id: "lead-1",
        buyerName: "Riley Ready"
      }
    ])
    mockBuildLeadExportCsv.mockReturnValue("First Name,Email\nRiley,riley@example.com\n")
    mockRecordAuditEvents.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
  })

  it("exports submitted leads for the authenticated agent and audits the request", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/mobile/leads/export.csv?from=2026-05-01&to=2026-05-04&timeZone=America%2FToronto",
        {
          headers: {
            authorization: "Bearer token",
            "user-agent": "ShowReady/1.0"
          }
        }
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/csv")
    expect(response.headers.get("content-disposition")).toContain(
      "showready-leads-2026-05-01-to-2026-05-04.csv"
    )
    expect(response.headers.get("x-lead-export-count")).toBe("1")
    await expect(response.text()).resolves.toBe("First Name,Email\nRiley,riley@example.com\n")
    expect(mockListSubmittedLeadsForCsvExport).toHaveBeenCalledWith(
      { scoped: true },
      "agent-1",
      expect.objectContaining({
        limit: 10000
      })
    )
    expect(mockBuildLeadExportCsv).toHaveBeenCalledWith(
      [
        {
          id: "lead-1",
          buyerName: "Riley Ready"
        }
      ],
      {
        agentFullName: "Demo Agent"
      }
    )
    expect(mockRecordAuditEvents).toHaveBeenCalledWith(
      { service: true },
      "agent-1",
      [
        expect.objectContaining({
          action: "privacy.export_requested",
          actorId: "agent-1",
          actorType: "agent",
          resourceType: "lead_export",
          requestIp: "203.0.113.10",
          userAgent: "ShowReady/1.0",
          metadata: {
            from: "2026-05-01",
            to: "2026-05-04",
            timeZone: "America/Toronto",
            exportedLeadCount: 1
          }
        })
      ]
    )
  })

  it("rejects missing or malformed date query values", async () => {
    const response = await GET(
      new Request("http://localhost/api/mobile/leads/export.csv?from=2026-05-01", {
        headers: {
          authorization: "Bearer token"
        }
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Export dates must use YYYY-MM-DD format."
    })
    expect(mockListSubmittedLeadsForCsvExport).not.toHaveBeenCalled()
  })

  it("rejects reversed date ranges before querying leads", async () => {
    const response = await GET(
      new Request("http://localhost/api/mobile/leads/export.csv?from=2026-05-05&to=2026-05-04", {
        headers: {
          authorization: "Bearer token"
        }
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "From date must be on or before to date."
    })
    expect(mockListSubmittedLeadsForCsvExport).not.toHaveBeenCalled()
  })

  it("returns auth failures through the shared mobile error response", async () => {
    const error = new MockMobileAuthError(401, "Missing bearer token.")
    mockRequireMobileAgent.mockRejectedValue(error)

    const response = await GET(new Request("http://localhost/api/mobile/leads/export.csv"))

    expect(response.status).toBe(401)
    expect(response.headers.get("x-request-id")).toBe("req-export")
    await expect(response.json()).resolves.toEqual({
      error: "Missing bearer token."
    })
  })
})
