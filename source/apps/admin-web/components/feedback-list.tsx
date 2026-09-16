import Link from "next/link"
import type { AdminFeedbackList } from "@showready/contracts"

function formatDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function FeedbackList({ result }: { result: AdminFeedbackList }) {
  if (result.items.length === 0) {
    return (
      <div className="sr-empty-state">
        <p>No feedback found.</p>
        <p>Adjust your search or date range and try again.</p>
      </div>
    )
  }

  return (
    <div className="sr-table-wrapper">
      <table className="sr-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Submitted</th>
            <th>Source</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link href={`/users/${item.agentId}`} className="sr-table-link">
                  {item.agentFullName}
                </Link>
              </td>
              <td>{formatDate(item.createdAt)}</td>
              <td>{item.source}</td>
              <td className="sr-table-message">{item.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sr-table-footer">
        {result.total} {result.total === 1 ? "entry" : "entries"}
      </div>
    </div>
  )
}
