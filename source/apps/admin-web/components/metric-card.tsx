export function MetricCard({
  label,
  value,
  helpText
}: {
  label: string
  value: number
  helpText: string
}) {
  return (
    <div className="sr-metric-card">
      <div className="sr-metric-card-value">{value.toLocaleString()}</div>
      <div className="sr-metric-card-label">{label}</div>
      <div className="sr-metric-card-help">{helpText}</div>
    </div>
  )
}
