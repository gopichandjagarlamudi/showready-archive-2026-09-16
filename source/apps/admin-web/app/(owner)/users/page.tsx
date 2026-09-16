import { loadAgents } from "@/lib/dashboard"
import { parseAgentListQuery, parseRangeDays } from "@/lib/query"
import { UserList } from "@/components/user-list"
import { DateRangeLinks } from "@/components/date-range-links"
import { PaginationLinks } from "@/components/pagination-links"

export default async function UsersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const input = parseAgentListQuery(params)
  const data = await loadAgents(input)

  return (
    <div className="sr-page">
      <h1 className="sr-page-title">Users</h1>

      <form className="sr-search-form" method="GET">
        <input
          type="search"
          name="query"
          defaultValue={
            typeof params.query === "string" ? params.query : ""
          }
          placeholder="Search by name or email..."
          className="sr-search-input"
        />
        <button type="submit" className="sr-search-button">Search</button>
      </form>

      <DateRangeLinks current={input.rangeDays} preserveParams={{ query: typeof params.query === "string" ? params.query : undefined }} />

      <UserList result={data} />

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
