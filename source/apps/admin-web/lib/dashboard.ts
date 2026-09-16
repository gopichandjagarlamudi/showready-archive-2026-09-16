import "server-only"

import {
  getAdminAgentDetail,
  getAdminDashboardOverview,
  listAdminAgents,
  listAdminFeedback
} from "@showready/application"
import type { AdminAgentListQuery, AdminFeedbackListQuery } from "@showready/contracts"
import { createAdminDashboardGateway } from "@showready/infrastructure"
import { buildPageCursors } from "@/lib/query"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

function getGateway() {
  return createAdminDashboardGateway(createSupabaseAdminClient())
}

export function loadOverview(rangeDays: 7 | 30 | 90) {
  return getAdminDashboardOverview(getGateway(), rangeDays)
}

export async function loadAgents(input: AdminAgentListQuery) {
  const result = await listAdminAgents(getGateway(), input)
  return { ...result, ...buildPageCursors(input.offset, result.items.length, result.total, input.pageSize) }
}

export function loadAgentDetail(agentId: string, rangeDays: 7 | 30 | 90) {
  return getAdminAgentDetail(getGateway(), agentId, rangeDays)
}

export async function loadFeedback(input: AdminFeedbackListQuery) {
  const result = await listAdminFeedback(getGateway(), input)
  return { ...result, ...buildPageCursors(input.offset, result.items.length, result.total, input.pageSize) }
}
