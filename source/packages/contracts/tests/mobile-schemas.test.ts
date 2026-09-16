import { describe, expect, it } from "vitest"
import {
  AppointmentInitialDataResponseSchema,
  AppointmentMutationSchema,
  ContactMethodSchema,
  FeedbackSubmissionSchema,
  HomeDataResponseSchema,
  LeadContactInteractionCreateSchema,
  LeadContactInteractionSchema,
  PipelineLeadListQuerySchema,
  ReviewLeadSchema,
  SettingsMutationSchema
} from "../src"

describe("mobile API schemas", () => {
  it("rejects unexpected fields in mobile mutation payloads", () => {
    expect(() =>
      ReviewLeadSchema.parse({
        leadId: "lead-1",
        pipelineStage: "nurture",
        role: "admin"
      })
    ).toThrow()

    expect(() =>
      SettingsMutationSchema.parse({
        fullName: "Demo Agent",
        emailNotificationsEnabled: true,
        serviceRoleKey: "secret"
      })
    ).toThrow()
  })

  it("bounds appointment and pipeline inputs", () => {
    expect(() =>
      AppointmentMutationSchema.parse({
        leadId: "lead-1",
        date: "not-a-date",
        startTime: "25:99",
        notes: "n".repeat(1001),
        showings: Array.from({ length: 11 }, (_, index) => ({
          address: `Showing ${index + 1}`
        }))
      })
    ).toThrow()

    expect(() =>
      PipelineLeadListQuerySchema.parse({
        query: "q".repeat(121),
        limit: "25",
        offset: "0"
      })
    ).toThrow()
  })

  it("validates feedback submissions", () => {
    expect(
      FeedbackSubmissionSchema.parse({
        message: "  Please add calendar sync.  "
      })
    ).toEqual({
      message: "Please add calendar sync."
    })

    expect(() =>
      FeedbackSubmissionSchema.parse({
        message: "   "
      })
    ).toThrow()

    expect(() =>
      FeedbackSubmissionSchema.parse({
        message: "x".repeat(2001)
      })
    ).toThrow()

    expect(() =>
      FeedbackSubmissionSchema.parse({
        message: "Please add calendar sync.",
        serviceRoleKey: "secret"
      })
    ).toThrow()
  })

  it("validates lead contact interaction payloads without duplicated contact values", () => {
    expect(ContactMethodSchema.parse("call")).toBe("call")
    expect(ContactMethodSchema.parse("text")).toBe("text")
    expect(ContactMethodSchema.parse("email")).toBe("email")
    expect(() => ContactMethodSchema.parse("sms")).toThrow()

    expect(
      LeadContactInteractionCreateSchema.parse({
        method: "text"
      })
    ).toEqual({
      method: "text"
    })

    expect(() =>
      LeadContactInteractionCreateSchema.parse({
        method: "call",
        phone: "416-555-0101"
      })
    ).toThrow()

    expect(
      LeadContactInteractionSchema.parse({
        id: "interaction-1",
        leadId: "lead-1",
        agentId: "agent-1",
        method: "email",
        occurredAt: "2026-05-03T15:30:00+00:00"
      })
    ).toMatchObject({
      id: "interaction-1",
      method: "email"
    })
  })

  it("validates consolidated mobile read responses", () => {
    const lead = {
      id: "lead-1",
      agentId: "agent-1",
      intakeType: "sale",
      buyerName: "Jordan Lane",
      token: "invite-token",
      tokenExpiresAt: "2026-05-11T12:00:00.000Z",
      status: "submitted",
      pipelineStage: "ready_to_show",
      createdAt: "2026-05-04T12:00:00.000Z",
      updatedAt: "2026-05-04T12:00:00.000Z"
    }
    const appointment = {
      id: "appointment-1",
      leadId: "lead-1",
      date: "2026-05-04",
      startTime: "14:30",
      status: "scheduled",
      createdAt: "2026-05-04T12:00:00.000Z",
      lead: {
        id: "lead-1",
        buyerName: "Jordan Lane",
        pipelineStage: "ready_to_show"
      },
      showings: [
        {
          id: "showing-1",
          appointmentId: "appointment-1",
          address: "123 Queen St W",
          orderIndex: 0
        }
      ]
    }

    expect(
      HomeDataResponseSchema.parse({
        summary: {
          totalLeads: 4,
          newLeads: 1,
          readyToShow: 2,
          appointmentBooked: 1,
          nurture: 1,
          hold: 0,
          averageScore: 7.5
        },
        recentLeads: [lead]
      })
    ).toMatchObject({
      summary: {
        totalLeads: 4
      },
      recentLeads: [
        {
          id: "lead-1"
        }
      ]
    })

    expect(
      AppointmentInitialDataResponseSchema.parse({
        appointments: {
          appointments: [appointment],
          total: 1
        },
        eligibleLeads: [lead]
      })
    ).toMatchObject({
      appointments: {
        total: 1
      },
      eligibleLeads: [
        {
          id: "lead-1"
        }
      ]
    })
  })
})
