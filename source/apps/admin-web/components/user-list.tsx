import Link from "next/link"
import type { AdminAgentList } from "@showready/contracts"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const date = new Date(iso)
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export function UserList({ result }: { result: AdminAgentList }) {
  if (result.items.length === 0) {
    return (
      <div className="sr-empty-state">
        <p>No users found.</p>
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
            <th>Brokerage</th>
            <th>Joined</th>
            <th>Last tracked activity</th>
            <th className="sr-numeric">Leads</th>
            <th className="sr-numeric">Submitted intakes</th>
            <th className="sr-numeric">Appointments</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link href={`/users/${item.id}`} className="sr-table-link">
                  {item.fullName}
                </Link>
                <div className="sr-table-sub">{item.email}</div>
              </td>
              <td>{item.brokerage ?? "—"}</td>
              <td>{formatDate(item.joinedAt)}</td>
              <td>{formatDate(item.lastTrackedActivityAt)}</td>
              <td className="sr-numeric">{item.leadCount}</td>
              <td className="sr-numeric">{item.submittedIntakeCount}</td>
              <td className="sr-numeric">{item.appointmentCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sr-table-footer">
        {result.total} {result.total === 1 ? "user" : "users"}
      </div>
    </div>
  )
}
