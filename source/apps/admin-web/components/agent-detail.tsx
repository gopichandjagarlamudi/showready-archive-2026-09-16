import type { AdminAgentDetail } from "@showready/contracts"
import { MetricCard } from "./metric-card"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const date = new Date(iso)
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function severityClass(severity: string) {
  if (severity === "error" || severity === "fatal") return "sr-severity-error"
  if (severity === "warning") return "sr-severity-warning"
  return "sr-severity-info"
}

export function AgentDetail({ detail }: { detail: AdminAgentDetail }) {
  const { profile, aggregates, recentEvents, feedback, diagnostics, serverErrors } = detail

  return (
    <div className="sr-agent-detail">
      <div className="sr-agent-profile">
        <h2 className="sr-agent-name">{profile.fullName}</h2>
        <div className="sr-agent-meta">
          <span>{profile.email}</span>
          {profile.brokerage && <span>{profile.brokerage}</span>}
        </div>
        <div className="sr-agent-dates">
          <span>Joined: {formatDate(profile.joinedAt)}</span>
          <span>Last activity: {formatDate(profile.lastTrackedActivityAt)}</span>
        </div>
      </div>

      <div className="sr-metric-grid">
        <MetricCard label="Leads" value={aggregates.leadCount} helpText="Total leads in range" />
        <MetricCard label="Submitted Intakes" value={aggregates.submittedIntakeCount} helpText="Intakes submitted in range" />
        <MetricCard label="Appointments" value={aggregates.appointmentCount} helpText="Appointments in range" />
      </div>

      <section className="sr-detail-section">
        <h3 className="sr-section-title">Recent tracked activity</h3>
        {recentEvents.length === 0 ? (
          <div className="sr-empty-state"><p>No tracked activity in range.</p></div>
        ) : (
          <div className="sr-table-wrapper">
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Occurred</th>
                  <th>Platform</th>
                  <th>App Version</th>
                  <th>Route</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event, i) => (
                  <tr key={i}>
                    <td>{event.eventName}</td>
                    <td>{formatDate(event.occurredAt)}</td>
                    <td>{event.platform ?? "—"}</td>
                    <td>{event.appVersion ?? "—"}</td>
                    <td>{event.route ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-detail-section">
        <h3 className="sr-section-title">Feedback</h3>
        {feedback.length === 0 ? (
          <div className="sr-empty-state"><p>No feedback in range.</p></div>
        ) : (
          <div className="sr-table-wrapper">
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Message</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((item) => (
                  <tr key={item.id}>
                    <td>{item.source}</td>
                    <td className="sr-table-message">{item.message}</td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-detail-section">
        <h3 className="sr-section-title">Diagnostics</h3>
        {diagnostics.length === 0 ? (
          <div className="sr-empty-state"><p>No diagnostics in range.</p></div>
        ) : (
          <div className="sr-table-wrapper">
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Message</th>
                  <th>Fingerprint</th>
                  <th>Screen</th>
                  <th>Request Path</th>
                  <th>App Version</th>
                  <th>Occurred</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`sr-severity-badge ${severityClass(item.severity)}`}>
                        {item.severity}
                      </span>
                    </td>
                    <td className="sr-table-message">{item.message}</td>
                    <td>{item.fingerprint ?? "—"}</td>
                    <td>{item.screen ?? "—"}</td>
                    <td>{item.requestPath ?? "—"}</td>
                    <td>{item.appVersion ?? "—"}</td>
                    <td>{formatDate(item.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-detail-section">
        <h3 className="sr-section-title">Server errors</h3>
        {serverErrors.length === 0 ? (
          <div className="sr-empty-state"><p>No server errors in range.</p></div>
        ) : (
          <div className="sr-table-wrapper">
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Error Type</th>
                  <th>Message</th>
                  <th>Route</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Occurred</th>
                </tr>
              </thead>
              <tbody>
                {serverErrors.map((item) => (
                  <tr key={item.id}>
                    <td>{item.errorType}</td>
                    <td className="sr-table-message">{item.message}</td>
                    <td>{item.route}</td>
                    <td>{item.path}</td>
                    <td>{item.status}</td>
                    <td>{formatDate(item.occurredAt)}</td>
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
