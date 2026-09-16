import { describe, expect, it } from "vitest"
import {
  mapAgentSettings,
  buildAnswerMaps,
  mapAppointment,
  mapLeadContactInteractionRecord,
  mapLeadRecord
} from "../src/mappers"

describe("supabase mappers", () => {
  it("maps legacy notification preferences onto mobile settings", () => {
    const settings = mapAgentSettings({
      agent_id: "agent-1",
      brand_name: "ShowReady",
      brand_color: "#0F766E",
      accent_color: "#A16207",
      show_threshold: 8,
      notification_preference: "email",
      question_template_id: "template-1"
    })

    expect(settings.emailNotificationsEnabled).toBe(true)
  })

  it("builds answer maps from flattened rows", () => {
    const result = buildAnswerMaps(
      [
        { question_key: "buyer.timeline", answer_value: "within_1_month" },
        { question_key: "custom.referral_source", answer_value: "Instagram" }
      ],
      {
        buyer_name: "Taylor Client",
        buyer_phone: null,
        buyer_email: "taylor@example.com",
        intake_type: "sale"
      }
    )

    expect(result.answers.contact.fullName).toBe("Taylor Client")
    expect(result.answers.intent).toBe("buy")
    expect(result.answers.buyer?.timeline).toBe("within_1_month")
    expect(result.customAnswers.referral_source).toBe("Instagram")
  })

  it("maps lead rows with review state", () => {
    const lead = mapLeadRecord({
      id: "lead-1",
      agent_id: "agent-1",
      intake_type: "sale",
      buyer_name: "Taylor Client",
      buyer_phone: null,
      buyer_email: "taylor@example.com",
      token: "token-1",
      token_expires_at: "2026-04-26T00:00:00.000Z",
      status: "submitted",
      pipeline_stage: "new",
      submitted_at: "2026-04-19T00:00:00.000Z",
      score: 8.4,
      recommendation: "show",
      summary: "Strong buyer lead",
      created_at: "2026-04-19T00:00:00.000Z",
      updated_at: "2026-04-19T00:00:00.000Z",
      reviewed_at: null,
      reviewed_stage: null
    })

    expect(lead.review?.suggestedStage).toBe("ready_to_show")
    expect(lead.buyerName).toBe("Taylor Client")
  })

  it("maps lead contact interactions without contact value PII", () => {
    const interaction = mapLeadContactInteractionRecord({
      id: "interaction-1",
      lead_id: "lead-1",
      agent_id: "agent-1",
      method: "text",
      occurred_at: "2026-05-03T15:30:00.000Z"
    })

    expect(interaction).toEqual({
      id: "interaction-1",
      leadId: "lead-1",
      agentId: "agent-1",
      method: "text",
      occurredAt: "2026-05-03T15:30:00.000Z"
    })
    expect(interaction).not.toHaveProperty("phone")
    expect(interaction).not.toHaveProperty("email")
  })

  it("normalizes Supabase timestamptz offsets for mobile contracts", () => {
    const interaction = mapLeadContactInteractionRecord({
      id: "interaction-1",
      lead_id: "lead-1",
      agent_id: "agent-1",
      method: "text",
      occurred_at: "2026-05-04T19:33:34.439+00:00"
    })

    expect(interaction.occurredAt).toBe("2026-05-04T19:33:34.439Z")
  })

  it("normalizes database appointment times to HH:mm for mobile contracts", () => {
    const appointment = mapAppointment(
      {
        id: "appointment-1",
        lead_id: "lead-1",
        date: "2026-05-04",
        start_time: "12:00:00",
        status: "scheduled",
        notes: null,
        created_at: "2026-05-04T14:00:00.000Z"
      },
      {
        id: "lead-1",
        buyer_name: "Taylor Client",
        buyer_phone: "+1 416 555 0101",
        buyer_email: "taylor@example.com",
        pipeline_stage: "ready_to_show"
      },
      []
    )

    expect(appointment.startTime).toBe("12:00")
  })

  it("attaches recent contact interactions to lead records", () => {
    const lead = mapLeadRecord(
      {
        id: "lead-1",
        agent_id: "agent-1",
        intake_type: "sale",
        buyer_name: "Taylor Client",
        buyer_phone: "416-555-0101",
        buyer_email: "taylor@example.com",
        token: "token-1",
        token_expires_at: "2026-04-26T00:00:00.000Z",
        status: "submitted",
        pipeline_stage: "ready_to_show",
        submitted_at: "2026-04-19T00:00:00.000Z",
        score: 8.4,
        recommendation: "show",
        summary: "Strong buyer lead",
        created_at: "2026-04-19T00:00:00.000Z",
        updated_at: "2026-04-19T00:00:00.000Z",
        reviewed_at: null,
        reviewed_stage: null
      },
      [],
      undefined,
      [
        {
          id: "interaction-1",
          lead_id: "lead-1",
          agent_id: "agent-1",
          method: "call",
          occurred_at: "2026-05-03T15:30:00.000Z"
        }
      ]
    )

    expect(lead.contactInteractions).toEqual([
      expect.objectContaining({
        method: "call",
        occurredAt: "2026-05-03T15:30:00.000Z"
      })
    ])
  })
})
