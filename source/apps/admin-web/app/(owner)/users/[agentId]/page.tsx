import { notFound } from "next/navigation"
import { z } from "zod"
import { loadAgentDetail } from "@/lib/dashboard"
import { parseRangeDays } from "@/lib/query"
import { AgentDetail } from "@/components/agent-detail"
import { DateRangeLinks } from "@/components/date-range-links"
import type { AdminDashboardRangeDays } from "@showready/contracts"

export default async function AgentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ agentId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { agentId } = await params
  const search = await searchParams

  const parsed = z.string().uuid().safeParse(agentId)
  if (!parsed.success) notFound()

  const rangeDays = parseRangeDays(
    typeof search.rangeDays === "string" ? Number(search.rangeDays) : undefined
  ) as AdminDashboardRangeDays

  const detail = await loadAgentDetail(parsed.data, rangeDays)
  if (!detail) notFound()

  return (
    <div className="sr-page">
      <DateRangeLinks current={rangeDays} />
      <AgentDetail detail={detail} />
    </div>
  )
}
