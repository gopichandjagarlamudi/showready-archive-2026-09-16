import { describe, expect, it, vi } from "vitest"
import { createAdminDashboardGateway } from "../src/admin-dashboard"

describe("createAdminDashboardGateway", () => {
  it("calls the overview RPC with the correct parameter and parses the response", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        rangeDays: 30,
        metrics: Array.from({ length: 8 }, () => ({ label: "Metric", value: 0, helpText: "Help" })),
        dailyEventVolume: [],
        errorGroups: []
      },
      error: null
    }))
    const gateway = createAdminDashboardGateway({ rpc } as never)

    const result = await gateway.getOverview(30)

    expect(rpc).toHaveBeenCalledWith("get_admin_dashboard_overview", { p_range_days: 30 })
    expect(result).toMatchObject({ rangeDays: 30, metrics: expect.any(Array), dailyEventVolume: [], errorGroups: [] })
  })

  it("calls the listAgents RPC with mapped parameters and parses the response", async () => {
    const rpc = vi.fn(async () => ({
      data: { items: [], total: 0 },
      error: null
    }))
    const gateway = createAdminDashboardGateway({ rpc } as never)

    const result = await gateway.listAgents({ query: "Morgan", rangeDays: 30, offset: 0, pageSize: 25 })

    expect(rpc).toHaveBeenCalledWith("list_admin_agents", { p_query: "Morgan", p_limit: 25, p_offset: 0 })
    expect(result).toMatchObject({ items: [], total: 0 })
  })

  it("calls the getAgentDetail RPC and returns the parsed detail", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        profile: { id: "00000000-0000-4000-8000-000000000001", fullName: "Morgan", email: "morgan@example.com", brokerage: null, joinedAt: null, lastTrackedActivityAt: null },
        aggregates: { leadCount: 0, submittedIntakeCount: 0, appointmentCount: 0 },
        recentEvents: [], feedback: [], diagnostics: [], serverErrors: []
      },
      error: null
    }))
    const gateway = createAdminDashboardGateway({ rpc } as never)

    const result = await gateway.getAgentDetail("00000000-0000-4000-8000-000000000001", 30)

    expect(rpc).toHaveBeenCalledWith("get_admin_agent_detail", { p_agent_id: "00000000-0000-4000-8000-000000000001", p_range_days: 30 })
    expect(result).toMatchObject({ profile: { fullName: "Morgan" } })
  })

  it("returns null when getAgentDetail RPC returns null data", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }))
    const gateway = createAdminDashboardGateway({ rpc } as never)

    const result = await gateway.getAgentDetail("00000000-0000-4000-8000-000000000001", 30)

    expect(result).toBeNull()
  })

  it("calls the listFeedback RPC with mapped parameters and parses the response", async () => {
    const rpc = vi.fn(async () => ({
      data: { items: [], total: 0 },
      error: null
    }))
    const gateway = createAdminDashboardGateway({ rpc } as never)

    const result = await gateway.listFeedback({ query: "help", rangeDays: 7, offset: 0, pageSize: 50 })

    expect(rpc).toHaveBeenCalledWith("list_admin_feedback", { p_query: "help", p_range_days: 7, p_limit: 50, p_offset: 0 })
    expect(result).toMatchObject({ items: [], total: 0 })
  })

  it("rejects a detail RPC response with forbidden client data", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        profile: { id: "00000000-0000-4000-8000-000000000001", fullName: "Morgan", email: "morgan@example.com", brokerage: null, joinedAt: null, lastTrackedActivityAt: null },
        aggregates: { leadCount: 0, submittedIntakeCount: 0, appointmentCount: 0 },
        recentEvents: [], feedback: [], diagnostics: [], serverErrors: [], buyerEmail: "client@example.com"
      },
      error: null
    }))
    const gateway = createAdminDashboardGateway({ rpc } as never)

    await expect(gateway.getAgentDetail("00000000-0000-4000-8000-000000000001", 30)).rejects.toThrow()
  })

  it("propagates Supabase RPC errors", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: new Error("db error") }))
    const gateway = createAdminDashboardGateway({ rpc } as never)

    await expect(gateway.getOverview(30)).rejects.toThrow("db error")
  })
})
