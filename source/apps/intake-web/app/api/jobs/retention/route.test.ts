import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const {
  mockCreateSupabaseAdminClient,
  mockRunRetentionCleanup,
  mockRequestErrorResponse
} = vi.hoisted(() => ({
  mockCreateSupabaseAdminClient: vi.fn(),
  mockRunRetentionCleanup: vi.fn(),
  mockRequestErrorResponse: vi.fn(async (input: {
    response: { error: string }
    status: number
  }) => Response.json(input.response, { status: input.status }))
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}))

vi.mock("@/lib/supabase/data", () => ({
  runRetentionCleanup: mockRunRetentionCleanup
}))

vi.mock("@/lib/observability", () => ({
  requestErrorResponse: mockRequestErrorResponse
}))

describe("GET /api/jobs/retention", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret"
    delete process.env.JOB_PROCESSOR_TOKEN
    mockCreateSupabaseAdminClient.mockReset()
    mockRunRetentionCleanup.mockReset()
    mockRequestErrorResponse.mockReset()
    mockCreateSupabaseAdminClient.mockReturnValue({ admin: true })
    mockRunRetentionCleanup.mockResolvedValue([
      {
        targetTable: "diagnostic_events",
        deletedCount: 2
      },
      {
        targetTable: "product_events",
        deletedCount: 3
      }
    ])
  })

  it("runs retention cleanup through the service client", async () => {
    const response = await GET(
      new Request("http://localhost/api/jobs/retention", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(mockRunRetentionCleanup).toHaveBeenCalledWith({ admin: true })
    await expect(response.json()).resolves.toEqual({
      cleanup: [
        {
          targetTable: "diagnostic_events",
          deletedCount: 2
        },
        {
          targetTable: "product_events",
          deletedCount: 3
        }
      ]
    })
  })

  it("rejects unauthenticated cron requests", async () => {
    const response = await GET(new Request("http://localhost/api/jobs/retention"))

    expect(response.status).toBe(401)
    expect(mockRunRetentionCleanup).not.toHaveBeenCalled()
  })
})
