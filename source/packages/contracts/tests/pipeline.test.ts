import { describe, expect, it } from "vitest"
import {
  AppointmentListQuerySchema,
  AppointmentListResponseSchema,
  DashboardSummarySchema,
  LeadListQuerySchema,
  LeadListResponseSchema,
  PipelineLeadListQuerySchema,
  PipelineLeadListResponseSchema
} from "../src"

describe("pipeline contracts", () => {
  it("normalizes pipeline query defaults and clamps pagination", () => {
    expect(
      PipelineLeadListQuerySchema.parse({
        tab: "active",
        category: "rent",
        limit: "100",
        offset: "5"
      })
    ).toEqual({
      tab: "active",
      category: "rent",
      limit: 50,
      offset: 5
    })
  })

  it("parses paginated pipeline lead responses with attention metadata", () => {
    expect(
      PipelineLeadListResponseSchema.parse({
        leads: [
          {
            id: "lead-1",
            agentId: "agent-1",
            intakeType: "sale",
            buyerName: "Riley Ready",
            buyerEmail: "riley@example.com",
            status: "submitted",
            pipelineStage: "ready_to_show",
            submittedAt: "2026-04-20T12:00:00.000Z",
            score: 8.4,
            recommendation: "show",
            summary: "Ready to tour.",
            createdAt: "2026-04-20T12:00:00.000Z",
            updatedAt: "2026-04-22T12:00:00.000Z",
            lastMovementAt: "2026-04-22T12:00:00.000Z",
            latestContactInteraction: {
              id: "interaction-1",
              leadId: "lead-1",
              agentId: "agent-1",
              method: "call",
              occurredAt: "2026-05-03T15:30:00.000Z"
            },
            attentionReason: "Ready to show with no appointment scheduled."
          }
        ],
        total: 1248,
        nextOffset: 25,
        mode: "focus_queue",
        summaryLabel: "Top 25 of 1,248 active leads"
      })
    ).toMatchObject({
      total: 1248,
      nextOffset: 25,
      mode: "focus_queue",
      leads: [
        {
          id: "lead-1",
          latestContactInteraction: {
            method: "call"
          },
          attentionReason: "Ready to show with no appointment scheduled."
        }
      ]
    })
  })

  it("normalizes mobile lead and appointment list queries", () => {
    expect(
      LeadListQuerySchema.parse({
        scope: "appointment_eligible",
        query: "  Riley  ",
        limit: "100",
        offset: "10"
      })
    ).toEqual({
      scope: "appointment_eligible",
      query: "Riley",
      limit: 50,
      offset: 10
    })

    expect(
      AppointmentListQuerySchema.parse({
        status: "completed",
        limit: "100",
        offset: "25"
      })
    ).toEqual({
      status: "completed",
      limit: 50,
      offset: 25
    })
  })

  it("parses paginated mobile list responses and dashboard new-lead counts", () => {
    const lead = {
      id: "lead-1",
      agentId: "agent-1",
      intakeType: "sale",
      buyerName: "Riley Ready",
      buyerEmail: "riley@example.com",
      token: "invite-token",
      tokenExpiresAt: "2026-04-30T12:00:00.000Z",
      status: "submitted",
      pipelineStage: "new",
      submittedAt: "2026-04-22T12:00:00.000Z",
      score: 8.4,
      recommendation: "show",
      summary: "Ready to tour.",
      createdAt: "2026-04-22T12:00:00.000Z",
      updatedAt: "2026-04-22T12:00:00.000Z"
    }

    expect(
      LeadListResponseSchema.parse({
        leads: [
          {
            ...lead,
            contactInteractions: [
              {
                id: "interaction-1",
                leadId: "lead-1",
                agentId: "agent-1",
                method: "text",
                occurredAt: "2026-05-03T15:30:00.000Z"
              }
            ]
          }
        ],
        total: 51,
        nextOffset: 25
      })
    ).toMatchObject({
      total: 51,
      nextOffset: 25,
      leads: [
        {
          id: "lead-1",
          contactInteractions: [
            {
              method: "text"
            }
          ]
        }
      ]
    })

    expect(
      AppointmentListResponseSchema.parse({
        appointments: [
          {
            id: "appointment-1",
            leadId: "lead-1",
            date: "2026-04-24",
            startTime: "14:30",
            status: "scheduled",
            createdAt: "2026-04-22T12:00:00.000Z",
            lead: {
              id: "lead-1",
              buyerName: "Riley Ready",
              buyerEmail: "riley@example.com",
              pipelineStage: "ready_to_show"
            },
            showings: []
          }
        ],
        total: 3
      })
    ).toMatchObject({
      total: 3,
      appointments: [{ id: "appointment-1" }]
    })

    expect(
      DashboardSummarySchema.parse({
        totalLeads: 12,
        newLeads: 2,
        readyToShow: 3,
        appointmentBooked: 1,
        nurture: 4,
        hold: 2,
        averageScore: 7.4
      })
    ).toMatchObject({
      newLeads: 2
    })
  })
})
