import Link from "next/link"

export function PaginationLinks({
  previousCursor,
  nextCursor,
  preserveParams = {}
}: {
  previousCursor?: string
  nextCursor?: string
  preserveParams?: Record<string, string | undefined>
}) {
  function buildHref(cursor: string | undefined) {
    if (!cursor) return "#"
    const params = new URLSearchParams()
    params.set("cursor", cursor)

    for (const [key, value] of Object.entries(preserveParams)) {
      if (value !== undefined && value !== "") {
        params.set(key, value)
      }
    }

    return `?${params.toString()}`
  }

  return (
    <div className="sr-pagination-links">
      {previousCursor ? (
        <Link href={buildHref(previousCursor)} className="sr-pagination-link">Previous</Link>
      ) : (
        <span className="sr-pagination-link sr-pagination-link-disabled">Previous</span>
      )}
      {nextCursor ? (
        <Link href={buildHref(nextCursor)} className="sr-pagination-link">Next</Link>
      ) : (
        <span className="sr-pagination-link sr-pagination-link-disabled">Next</span>
      )}
    </div>
  )
}
