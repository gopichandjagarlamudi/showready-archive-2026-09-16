import { loadOverview } from "@/lib/dashboard"
import { parseRangeDays } from "@/lib/query"
import { MetricCard } from "@/components/metric-card"
import type { AdminDashboardRangeDays } from "@showready/contracts"

export default async function OverviewPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rangeDays = parseRangeDays(
    typeof params.rangeDays === "string" ? Number(params.rangeDays) : undefined
  ) as AdminDashboardRangeDays
  const data = await loadOverview(rangeDays)

  return (
    <div className="sr-overview">
      <h1 className="sr-page-title">Dashboard</h1>

      <div className="sr-metric-grid sr-metric-grid-8">
        {data.metrics.map((metric, i) => (
          <MetricCard key={i} label={metric.label} value={metric.value} helpText={metric.helpText} />
        ))}
      </div>

      <section className="sr-detail-section">
        <h2 className="sr-section-title">Daily event volume</h2>
        {data.dailyEventVolume.length === 0 ? (
          <div className="sr-empty-state"><p>No event data in range.</p></div>
        ) : (
          <div className="sr-table-wrapper">
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="sr-numeric">Events</th>
                </tr>
              </thead>
              <tbody>
                {data.dailyEventVolume.map((entry) => (
                  <tr key={entry.date}>
                    <td>{entry.date}</td>
                    <td className="sr-numeric">{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-detail-section">
        <h2 className="sr-section-title">Top error groups</h2>
        {data.errorGroups.length === 0 ? (
          <div className="sr-empty-state"><p>No errors in range.</p></div>
        ) : (
          <div className="sr-table-wrapper">
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Label</th>
                  <th className="sr-numeric">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.errorGroups.map((group, i) => (
                  <tr key={i}>
                    <td>{group.source}</td>
                    <td>{group.label}</td>
                    <td className="sr-numeric">{group.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
