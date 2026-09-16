import {
  AdminCursorPayloadSchema,
  AdminDashboardRangeDaysSchema,
  AdminPageSizeSchema,
  type AdminAgentListQuery,
  type AdminFeedbackListQuery
} from "@showready/contracts"

export function encodeCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url")
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) {
    return 0
  }

  try {
    const value = Buffer.from(cursor, "base64url").toString("utf8")
    const result = AdminCursorPayloadSchema.safeParse(JSON.parse(value))

    if (!result.success) {
      return 0
    }

    return result.data.offset
  } catch {
    return 0
  }
}

export function parseRangeDays(raw: unknown): 7 | 30 | 90 {
  const result = AdminDashboardRangeDaysSchema.safeParse(raw)
  return result.success ? result.data : 30
}

export function parseAgentListQuery(params: Record<string, string | string[] | undefined>): AdminAgentListQuery {
  const rawQuery = typeof params.query === "string" ? params.query : ""
  const trimmedQuery = rawQuery.trim()
  const query = trimmedQuery.length > 100 ? "" : trimmedQuery

  const pageSize = AdminPageSizeSchema.safeParse(Number(params.pageSize)).success
    ? (Number(params.pageSize) as 25 | 50)
    : 25

  const offset = decodeCursor(
    typeof params.cursor === "string" ? params.cursor : undefined
  )

  const rangeDays = parseRangeDays(
    typeof params.rangeDays === "string" ? Number(params.rangeDays) : undefined
  )

  return { query, rangeDays, offset, pageSize }
}

export function parseFeedbackListQuery(params: Record<string, string | string[] | undefined>): AdminFeedbackListQuery {
  const rawQuery = typeof params.query === "string" ? params.query : ""
  const trimmedQuery = rawQuery.trim()
  const query = trimmedQuery.length > 100 ? "" : trimmedQuery

  const pageSize = AdminPageSizeSchema.safeParse(Number(params.pageSize)).success
    ? (Number(params.pageSize) as 25 | 50)
    : 25

  const offset = decodeCursor(
    typeof params.cursor === "string" ? params.cursor : undefined
  )

  const rangeDays = parseRangeDays(
    typeof params.rangeDays === "string" ? Number(params.rangeDays) : undefined
  )

  return { query, rangeDays, offset, pageSize }
}

export function buildPageCursors(
  offset: number,
  itemCount: number,
  total: number,
  pageSize: number
) {
  const previousCursor = offset > 0 ? encodeCursor(Math.max(0, offset - pageSize)) : undefined
  const hasMore = offset + itemCount < total
  const nextCursor = hasMore ? encodeCursor(offset + pageSize) : undefined

  return { previousCursor, nextCursor }
}
