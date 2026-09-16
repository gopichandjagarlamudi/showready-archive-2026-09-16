import { describe, expect, it } from "vitest"
import {
  AuditEventSchema,
  ConsentRecordSchema,
  ProductEventBatchSchema,
  ProductEventSchema
} from "../src"

describe("ProductEventSchema", () => {
  it("parses a product event with bounded non-PII properties", () => {
    const parsed = ProductEventSchema.parse({
      id: "1d0bd5f6-51bd-4d65-a046-608c209f6c92",
      occurredAt: "2026-04-29T12:00:00.000Z",
      eventName: "lead.stage_changed",
      agentId: "agent-1",
      actorId: "agent-1",
      resourceType: "lead",
      resourceId: "lead-1",
      platform: "ios",
      appVersion: "0.1.0",
      route: "/lead/lead-1",
      properties: {
        fromStage: "new",
        toStage: "nurture",
        durationMs: 450
      }
    })

    expect(parsed.eventName).toBe("lead.stage_changed")
    expect(parsed.properties).toEqual({
      fromStage: "new",
      toStage: "nurture",
      durationMs: 450
    })
  })

  it("rejects unknown product event names", () => {
    expect(() =>
      ProductEventSchema.parse({
        id: "1d0bd5f6-51bd-4d65-a046-608c209f6c92",
        occurredAt: "2026-04-29T12:00:00.000Z",
        eventName: "lead.private_note_saved",
        platform: "web"
      })
    ).toThrow()
  })

  it("rejects oversized event metadata", () => {
    expect(() =>
      ProductEventSchema.parse({
        id: "1d0bd5f6-51bd-4d65-a046-608c209f6c92",
        occurredAt: "2026-04-29T12:00:00.000Z",
        eventName: "intake.step_completed",
        platform: "web",
        properties: {
          stepKey: "x".repeat(2001)
        }
      })
    ).toThrow()
  })
})

describe("ProductEventBatchSchema", () => {
  it("requires at least one product event", () => {
    expect(() =>
      ProductEventBatchSchema.parse({
        events: []
      })
    ).toThrow()
  })
})

describe("AuditEventSchema", () => {
  it("parses an audit event with bounded summaries", () => {
    const parsed = AuditEventSchema.parse({
      id: "ab831397-3813-44ca-8495-0e778f8a1aa0",
      occurredAt: "2026-04-29T12:00:00.000Z",
      action: "lead.score_overridden",
      actorType: "agent",
      actorId: "agent-1",
      agentId: "agent-1",
      resourceType: "lead",
      resourceId: "lead-1",
      platform: "ios",
      beforeSummary: {
        scoreBand: "medium"
      },
      afterSummary: {
        scoreBand: "high"
      }
    })

    expect(parsed.action).toBe("lead.score_overridden")
    expect(parsed.beforeSummary).toEqual({
      scoreBand: "medium"
    })
  })
})

describe("ConsentRecordSchema", () => {
  it("parses a consent record with a policy version", () => {
    const parsed = ConsentRecordSchema.parse({
      id: "61ae65c3-f103-45c6-9a42-a9f5e1785b2f",
      subjectType: "agent",
      subjectId: "agent-1",
      agentId: "agent-1",
      consentType: "privacy_policy",
      status: "granted",
      policyVersion: "2026-04-29",
      source: "mobile-settings",
      occurredAt: "2026-04-29T12:00:00.000Z"
    })

    expect(parsed.status).toBe("granted")
    expect(parsed.metadata).toEqual({})
  })
})
