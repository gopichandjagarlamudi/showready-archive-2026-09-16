import { describe, expect, it } from "vitest"
import {
  AdminAgentDetailSchema,
  AdminAgentListSchema,
  AdminDashboardRangeDaysSchema,
  AdminFeedbackListQuerySchema
} from "../src/admin-dashboard"

describe("admin dashboard contracts", () => {
  it("accepts only the supported dashboard date ranges", () => {
    expect(AdminDashboardRangeDaysSchema.parse(7)).toBe(7)
    expect(AdminDashboardRangeDaysSchema.parse(30)).toBe(30)
    expect(AdminDashboardRangeDaysSchema.parse(90)).toBe(90)
    expect(() => AdminDashboardRangeDaysSchema.parse(14)).toThrow()
  })

  it("bounds feedback search and pagination", () => {
    expect(
      AdminFeedbackListQuerySchema.parse({
        query: "Morgan",
        rangeDays: 30,
        offset: 25
      })
    ).toMatchObject({ query: "Morgan", rangeDays: 30, offset: 25, pageSize: 25 })

    expect(() =>
      AdminFeedbackListQuerySchema.parse({ query: "x".repeat(101), rangeDays: 30 })
    ).toThrow()
  })

  it("accepts PostgreSQL offset timestamps in agent list responses", () => {
    expect(
      AdminAgentListSchema.parse({
        items: [{
          id: "00000000-0000-4000-8000-000000000001",
          fullName: "Morgan",
          email: "morgan@example.com",
          brokerage: null,
          joinedAt: "2026-07-15T12:00:00+00:00",
          lastTrackedActivityAt: "2026-07-15T12:30:00+00:00",
          leadCount: 0,
          submittedIntakeCount: 0,
          appointmentCount: 0
        }],
        total: 1
      })
    ).toMatchObject({ total: 1 })
  })

  it("rejects agent detail payloads that contain lead or client data", () => {
    expect(() =>
      AdminAgentDetailSchema.parse({
        profile: {
          id: "00000000-0000-4000-8000-000000000001",
          fullName: "Morgan",
          email: "morgan@example.com",
          brokerage: null,
          joinedAt: null,
          lastTrackedActivityAt: null
        },
        aggregates: { leadCount: 4, submittedIntakeCount: 3, appointmentCount: 1 },
        recentEvents: [],
        feedback: [],
        diagnostics: [],
        serverErrors: [],
        buyerName: "Must not cross the boundary"
      })
    ).toThrow()
  })
})
