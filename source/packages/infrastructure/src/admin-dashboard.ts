import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AdminAgentDetailSchema,
  AdminAgentListSchema,
  AdminDashboardOverviewSchema,
  AdminFeedbackListSchema,
  type AdminAgentListQuery,
  type AdminDashboardRangeDays,
  type AdminFeedbackListQuery
} from "@showready/contracts"
import type { AdminDashboardGateway } from "@showready/application"

async function getRpcJson<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T
) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return parse(data)
}

export function createAdminDashboardGateway(client: SupabaseClient): AdminDashboardGateway {
  return {
    getOverview(rangeDays: AdminDashboardRangeDays) {
      return getRpcJson(client, "get_admin_dashboard_overview", { p_range_days: rangeDays }, (data) =>
        AdminDashboardOverviewSchema.parse(data)
      )
    },
    listAgents(input: AdminAgentListQuery) {
      return getRpcJson(client, "list_admin_agents", {
        p_query: input.query,
        p_limit: input.pageSize,
        p_offset: input.offset
      }, (data) => AdminAgentListSchema.parse(data))
    },
    getAgentDetail(agentId: string, rangeDays: AdminDashboardRangeDays) {
      return getRpcJson(client, "get_admin_agent_detail", {
        p_agent_id: agentId,
        p_range_days: rangeDays
      }, (data) => data === null ? null : AdminAgentDetailSchema.parse(data))
    },
    listFeedback(input: AdminFeedbackListQuery) {
      return getRpcJson(client, "list_admin_feedback", {
        p_query: input.query,
        p_range_days: input.rangeDays,
        p_limit: input.pageSize,
        p_offset: input.offset
      }, (data) => AdminFeedbackListSchema.parse(data))
    }
  }
}
