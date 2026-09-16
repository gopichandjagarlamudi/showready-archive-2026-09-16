import Link from "next/link"

const RANGES = [7, 30, 90] as const

export function DateRangeLinks({
  current,
  preserveParams = {}
}: {
  current: number
  preserveParams?: Record<string, string | undefined>
}) {
  function buildHref(days: number) {
    const params = new URLSearchParams()
    params.set("rangeDays", String(days))

    for (const [key, value] of Object.entries(preserveParams)) {
      if (value !== undefined && value !== "") {
        params.set(key, value)
      }
    }

    return `?${params.toString()}`
  }

  return (
    <div className="sr-date-range-links">
      {RANGES.map((days) => (
        <Link
          key={days}
          href={buildHref(days)}
          className={days === current ? "sr-date-range-link sr-date-range-link-active" : "sr-date-range-link"}
        >
          {days}d
        </Link>
      ))}
    </div>
  )
}
