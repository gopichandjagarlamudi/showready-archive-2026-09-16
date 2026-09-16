import { loadFeedback } from "@/lib/dashboard"
import { parseFeedbackListQuery } from "@/lib/query"
import { FeedbackList } from "@/components/feedback-list"
import { DateRangeLinks } from "@/components/date-range-links"
import { PaginationLinks } from "@/components/pagination-links"

export default async function FeedbackPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const input = parseFeedbackListQuery(params)
  const data = await loadFeedback(input)

  return (
    <div className="sr-page">
      <h1 className="sr-page-title">Feedback</h1>

      <form className="sr-search-form" method="GET">
        <input
          type="search"
          name="query"
          defaultValue={
            typeof params.query === "string" ? params.query : ""
          }
          placeholder="Search by agent name or message..."
          className="sr-search-input"
        />
        <button type="submit" className="sr-search-button">Search</button>
      </form>

      <DateRangeLinks current={input.rangeDays} preserveParams={{ query: typeof params.query === "string" ? params.query : undefined }} />

      <FeedbackList result={data} />

      <PaginationLinks
        previousCursor={data.previousCursor}
        nextCursor={data.nextCursor}
        preserveParams={{
          query: typeof params.query === "string" ? params.query : undefined,
          pageSize: String(input.pageSize)
        }}
      />
    </div>
  )
}
