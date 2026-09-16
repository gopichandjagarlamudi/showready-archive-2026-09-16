import { describe, expect, it } from "vitest"
import { buildPageCursors, decodeCursor, encodeCursor, parseAgentListQuery, parseFeedbackListQuery, parseRangeDays } from "./query"

describe("query parsing", () => {
  describe("parseRangeDays", () => {
    it("returns 30 for invalid input", () => {
      expect(parseRangeDays(undefined)).toBe(30)
      expect(parseRangeDays("invalid")).toBe(30)
      expect(parseRangeDays(15)).toBe(30)
    })

    it("returns valid range day values", () => {
      expect(parseRangeDays(7)).toBe(7)
      expect(parseRangeDays(30)).toBe(30)
      expect(parseRangeDays(90)).toBe(90)
    })
  })

  describe("encodeCursor / decodeCursor", () => {
    it("round-trips valid offsets", () => {
      const encoded = encodeCursor(42)
      expect(decodeCursor(encoded)).toBe(42)
    })

    it("returns 0 for null or undefined cursor", () => {
      expect(decodeCursor(null)).toBe(0)
      expect(decodeCursor(undefined)).toBe(0)
    })

    it("returns 0 for malformed cursor", () => {
      expect(decodeCursor("not-valid-base64!!!")).toBe(0)
    })

    it("rejects negative offsets", () => {
      const encoded = encodeCursor(-1)
      expect(decodeCursor(encoded)).toBe(0)
    })

    it("rejects offsets greater than 5000", () => {
      const encoded = encodeCursor(5001)
      expect(decodeCursor(encoded)).toBe(0)
    })

    it("rejects non-integer offsets", () => {
      const encoded = Buffer.from(JSON.stringify({ offset: 1.5 }), "utf8").toString("base64url")
      expect(decodeCursor(encoded)).toBe(0)
    })
  })

  describe("parseAgentListQuery", () => {
    it("replaces overlong query with empty string", () => {
      const result = parseAgentListQuery({ query: "a".repeat(101) })
      expect(result.query).toBe("")
    })

    it("parses page size as 25 or 50, defaulting to 25", () => {
      expect(parseAgentListQuery({ pageSize: "25" }).pageSize).toBe(25)
      expect(parseAgentListQuery({ pageSize: "50" }).pageSize).toBe(50)
      expect(parseAgentListQuery({ pageSize: "99" }).pageSize).toBe(25)
      expect(parseAgentListQuery({}).pageSize).toBe(25)
    })

    it("decodes cursor to offset", () => {
      const cursor = encodeCursor(100)
      expect(parseAgentListQuery({ cursor }).offset).toBe(100)
    })
  })

  describe("parseFeedbackListQuery", () => {
    it("replaces overlong query with empty string", () => {
      const result = parseFeedbackListQuery({ query: "a".repeat(101) })
      expect(result.query).toBe("")
    })
  })

  describe("buildPageCursors", () => {
    it("yields cursors that decode to correct offsets", () => {
      const { previousCursor, nextCursor } = buildPageCursors(25, 25, 75, 25)
      expect(decodeCursor(previousCursor!)).toBe(0)
      expect(decodeCursor(nextCursor!)).toBe(50)
    })

    it("returns undefined next cursor when at end of list", () => {
      const { nextCursor } = buildPageCursors(50, 25, 75, 25)
      expect(nextCursor).toBeUndefined()
    })
  })
})
