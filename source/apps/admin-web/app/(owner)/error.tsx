"use client"

export default function OwnerError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="sr-error-page">
      <h2>Unable to load dashboard data.</h2>
      <button onClick={reset} className="sr-error-button">
        Try again
      </button>
    </div>
  )
}
