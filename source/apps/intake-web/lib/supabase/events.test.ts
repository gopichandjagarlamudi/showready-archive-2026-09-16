import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  getAnalyticsSummary,
  getLeadById,
  listAppointments,
  recordAgentFeedback,
  recordConsentRecords,
  recordLeadContactInteraction,
  recordProductEvents,
  submitInvite
} from "./data"

function createUpsertClient() {
  const upsert = vi.fn(async () => ({ error: null }))
  const from = vi.fn(() => ({ upsert }))

  return {
    client: { from },
    from,
    upsert
  }
}

describe("first-party event persistence", () => {
  it("maps product events to snake_case database rows", async () => {
    const { client, from, upsert } = createUpsertClient()

    await recordProductEvents(client as never, "agent-1", [
      {
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
          toStage: "nurture"
        }
      }
    ])

    expect(from).toHaveBeenCalledWith("product_events")
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          id: "1d0bd5f6-51bd-4d65-a046-608c209f6c92",
          agent_id: "agent-1",
          workspace_id: null,
          actor_id: "agent-1",
          event_name: "lead.stage_changed",
          resource_type: "lead",
          resource_id: "lead-1",
          platform: "ios",
          app_version: "0.1.0",
          build_number: null,
          route: "/lead/lead-1",
          properties: {
            fromStage: "new",
            toStage: "nurture"
          },
          occurred_at: "2026-04-29T12:00:00.000Z"
        }
      ],
      {
        onConflict: "id",
        ignoreDuplicates: true
      }
    )
  })

  it("maps consent records to snake_case database rows", async () => {
    const { client, from, upsert } = createUpsertClient()

    await recordConsentRecords(client as never, "agent-1", [
      {
        id: "61ae65c3-f103-45c6-9a42-a9f5e1785b2f",
        subjectType: "agent",
        subjectId: "agent-1",
        agentId: "agent-1",
        consentType: "privacy_policy",
        status: "granted",
        policyVersion: "2026-04-29",
        source: "mobile-settings",
        occurredAt: "2026-04-29T12:00:00.000Z",
        metadata: {}
      }
    ])

    expect(from).toHaveBeenCalledWith("consent_records")
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          id: "61ae65c3-f103-45c6-9a42-a9f5e1785b2f",
          subject_type: "agent",
          subject_id: "agent-1",
          agent_id: "agent-1",
          consent_type: "privacy_policy",
          status: "granted",
          policy_version: "2026-04-29",
          source: "mobile-settings",
          metadata: {},
          occurred_at: "2026-04-29T12:00:00.000Z",
          expires_at: null
        }
      ],
      {
        onConflict: "id",
        ignoreDuplicates: true
      }
    )
  })

  it("maps agent feedback to a database row", async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({ insert }))
    const client = { from }

    await recordAgentFeedback(client as never, "agent-1", {
      message: "Please add calendar sync.",
      source: "mobile-settings"
    })

    expect(from).toHaveBeenCalledWith("agent_feedback")
    expect(insert).toHaveBeenCalledWith({
      agent_id: "agent-1",
      message: "Please add calendar sync.",
      source: "mobile-settings"
    })
  })

  it("records lead contact interactions without duplicating phone or email values", async () => {
    let insertedRow: Record<string, unknown> | undefined
    const leadQuery = {
      select: vi.fn(() => leadQuery),
      eq: vi.fn(() => leadQuery),
      maybeSingle: vi.fn(async () => ({ data: { id: "lead-1" }, error: null }))
    }
    const interactionQuery = {
      insert: vi.fn((row: Record<string, unknown>) => {
        insertedRow = row
        return interactionQuery
      }),
      select: vi.fn(() => interactionQuery),
      single: vi.fn(async () => ({
        data: {
          id: "interaction-1",
          lead_id: insertedRow?.lead_id,
          agent_id: insertedRow?.agent_id,
          method: insertedRow?.method,
          occurred_at: insertedRow?.occurred_at
        },
        error: null
      }))
    }
    const from = vi.fn((table: string) =>
      table === "leads" ? leadQuery : interactionQuery
    )

    const interaction = await recordLeadContactInteraction({ from } as never, "agent-1", "lead-1", "text")

    expect(from).toHaveBeenCalledWith("leads")
    expect(from).toHaveBeenCalledWith("lead_contact_interactions")
    expect(insertedRow).toMatchObject({
      agent_id: "agent-1",
      lead_id: "lead-1",
      method: "text"
    })
    expect(insertedRow).not.toHaveProperty("phone")
    expect(insertedRow).not.toHaveProperty("email")
    expect(interaction).toMatchObject({
      id: "interaction-1",
      leadId: "lead-1",
      agentId: "agent-1",
      method: "text"
    })
  })

  it("loads the latest five contact interactions with lead detail", async () => {
    const leadRow = {
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
    }
    const interactionRows = Array.from({ length: 5 }, (_, index) => ({
      id: `interaction-${index + 1}`,
      lead_id: "lead-1",
      agent_id: "agent-1",
      method: index % 2 === 0 ? "call" : "email",
      occurred_at: `2026-05-03T1${index}:30:00.000Z`
    }))
    const interactionLimit = vi.fn()

    function createQuery(result: unknown) {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn((limit: number) => {
          interactionLimit(limit)
          return query
        }),
        maybeSingle: vi.fn(async () => ({ data: leadRow, error: null })),
        then: (onfulfilled?: (value: unknown) => unknown) =>
          Promise.resolve(result).then(onfulfilled)
      }
      return query
    }

    const from = vi.fn((table: string) => {
      if (table === "leads") {
        return createQuery({ data: leadRow, error: null })
      }

      if (table === "lead_contact_interactions") {
        return createQuery({ data: interactionRows, error: null })
      }

      return createQuery({ data: [], error: null })
    })

    const lead = await getLeadById({ from } as never, "agent-1", "lead-1")

    expect(from).toHaveBeenCalledWith("lead_contact_interactions")
    expect(interactionLimit).toHaveBeenCalledWith(5)
    expect(lead?.contactInteractions).toHaveLength(5)
    expect(lead?.contactInteractions?.[0]).toMatchObject({
      id: "interaction-1",
      method: "call"
    })
  })

  it("loads lead detail with empty contact history when contact storage is unavailable", async () => {
    const leadRow = {
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
    }

    function createQuery(result: unknown) {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: leadRow, error: null })),
        then: (onfulfilled?: (value: unknown) => unknown) =>
          Promise.resolve(result).then(onfulfilled)
      }
      return query
    }

    const from = vi.fn((table: string) => {
      if (table === "leads") {
        return createQuery({ data: leadRow, error: null })
      }

      if (table === "lead_contact_interactions") {
        return createQuery({
          data: null,
          error: {
            code: "PGRST205",
            message: "Could not find the table 'public.lead_contact_interactions' in the schema cache"
          }
        })
      }

      return createQuery({ data: [], error: null })
    })

    const lead = await getLeadById({ from } as never, "agent-1", "lead-1")

    expect(lead?.id).toBe("lead-1")
    expect(lead?.contactInteractions).toEqual([])
  })

  it("fails fast when the dashboard summary RPC is unavailable", async () => {
    const missingRpcError = {
      code: "PGRST202",
      message: "Could not find the function public.get_agent_dashboard_summary(p_agent_id)."
    }
    const rpc = vi.fn(async () => ({
      data: null,
      error: missingRpcError
    }))
    const from = vi.fn()

    await expect(getAnalyticsSummary({ from, rpc } as never, "agent-1")).rejects.toBe(
      missingRpcError
    )

    expect(rpc).toHaveBeenCalledWith("get_agent_dashboard_summary", {
      p_agent_id: "agent-1"
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("loads appointments through the appointment tenant scope", async () => {
    const appointmentEq = vi.fn()
    const appointmentSelect = vi.fn()
    const appointmentRange = vi.fn()

    function createQuery(data: unknown[] = [], count = data.length) {
      const query = {
        select: vi.fn((columns: string, options?: unknown) => {
          appointmentSelect(columns, options)
          return query
        }),
        eq: vi.fn((column: string, value: unknown) => {
          appointmentEq(column, value)
          return query
        }),
        order: vi.fn(() => query),
        range: vi.fn((from: number, to: number) => {
          appointmentRange(from, to)
          return query
        }),
        then: (onfulfilled?: (value: unknown) => unknown) =>
          Promise.resolve({ data, error: null, count }).then(onfulfilled)
      }
      return query
    }

    const from = vi.fn((table: string) =>
      table === "appointments" ? createQuery([], 0) : createQuery([])
    )

    const result = await listAppointments({ from } as never, "agent-1", {
      status: "scheduled",
      limit: 25,
      offset: 0
    })

    expect(result).toEqual({
      appointments: [],
      total: 0
    })
    expect(appointmentSelect).toHaveBeenCalledWith(
      expect.stringContaining("leads!inner"),
      { count: "exact" }
    )
    expect(appointmentRange).toHaveBeenCalledWith(0, 25)
    expect(appointmentEq).toHaveBeenCalledWith("agent_id", "agent-1")
    expect(appointmentEq).not.toHaveBeenCalledWith("leads.agent_id", "agent-1")
  })

  it("finalizes intake submit through the transactional RPC", async () => {
    const now = "2026-05-04T12:00:00.000Z"
    const invite = {
      id: "invite-1",
      agent_id: "agent-1",
      token: "invite-token",
      status: "converted",
      token_expires_at: "2099-01-01T00:00:00.000Z",
      created_at: now,
      updated_at: now,
      opened_at: now,
      lead_id: "lead-1",
      draft_payload: null
    }
    const settings = {
      agent_id: "agent-1",
      brand_name: "ShowReady",
      brand_color: "#111111",
      accent_color: "#0ea5e9",
      show_threshold: 7,
      email_notifications_enabled: true,
      question_template_id: "template-1"
    }
    const pendingLead = {
      id: "lead-1",
      agent_id: "agent-1",
      intake_type: "sale",
      buyer_name: "Taylor Verify",
      buyer_phone: "416-555-0101",
      buyer_email: "taylor@example.com",
      token: "invite-token",
      token_expires_at: "2099-01-01T00:00:00.000Z",
      status: "draft",
      pipeline_stage: "new",
      submitted_at: null,
      score: null,
      recommendation: null,
      summary: null,
      created_at: now,
      updated_at: now,
      reviewed_at: null,
      reviewed_stage: null
    }
    const submittedLead = {
      ...pendingLead,
      status: "submitted",
      submitted_at: now,
      score: 8.8,
      recommendation: "show",
      summary: "Ready buyer. Invite them to a showing."
    }
    const rpc = vi.fn(async (name: string) => {
      if (name === "finalize_submitted_invite") {
        return { data: submittedLead, error: null }
      }

      return { data: null, error: new Error(`Unexpected RPC: ${name}`) }
    })
    const leadScoresInsert = vi.fn(async () => ({ error: null }))
    const leadUpdate = vi.fn((_values: Record<string, unknown>) => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: submittedLead, error: null }))
        }))
      }))
    }))

    function createQuery(table: string) {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        delete: vi.fn(() => query),
        update: vi.fn((values: Record<string, unknown>) => {
          if (table === "leads" && "status" in values) {
            return leadUpdate(values)
          }

          return query
        }),
        insert: table === "lead_scores" ? leadScoresInsert : vi.fn(async () => ({ error: null })),
        upsert: vi.fn(async () => ({ error: null })),
        maybeSingle: vi.fn(async () => {
          if (table === "invites") {
            return { data: invite, error: null }
          }

          if (table === "leads") {
            return { data: { status: "draft" }, error: null }
          }

          return { data: null, error: null }
        }),
        single: vi.fn(async () => {
          if (table === "leads") {
            return { data: pendingLead, error: null }
          }

          if (table === "agent_settings") {
            return { data: settings, error: null }
          }

          return { data: null, error: null }
        }),
        then: (onfulfilled?: (value: unknown) => unknown) => {
          if (table === "lead_answers") {
            return Promise.resolve({ data: [], error: null }).then(onfulfilled)
          }

          if (table === "lead_scores") {
            return Promise.resolve({
              data: [
                {
                  breakdown: {
                    urgency: 2,
                    finances: 2,
                    clarity: 2,
                    readiness: 2,
                    fit: 1
                  },
                  overridden: false,
                  override_meta: null
                }
              ],
              error: null
            }).then(onfulfilled)
          }

          return Promise.resolve({ data: [], error: null }).then(onfulfilled)
        }
      }

      return query
    }

    const from = vi.fn((table: string) => createQuery(table))
    const draft = {
      contact: {
        fullName: "Taylor Verify",
        email: "taylor@example.com",
        phone: "416-555-0101"
      },
      intent: "buy" as const,
      buyer: {
        buyingFor: "myself" as const,
        timeline: "within_1_month" as const,
        budgetKnowledge: "know_it" as const,
        mortgageStatus: "pre_approved" as const,
        neighborhoods: "Toronto",
        propertyType: ["condo" as const]
      }
    }

    await submitInvite({ from, rpc } as never, "invite-token", { draft })

    expect(rpc).toHaveBeenCalledWith(
      "finalize_submitted_invite",
      expect.objectContaining({
        p_agent_id: "agent-1",
        p_lead_id: "lead-1",
        p_recommendation: "show"
      })
    )
    expect(leadScoresInsert).not.toHaveBeenCalled()
    expect(leadUpdate).not.toHaveBeenCalled()
  })

  it("submits after saving answers when lead_answers has no upsert conflict index", async () => {
    const now = "2026-05-04T12:00:00.000Z"
    const invite = {
      id: "invite-1",
      agent_id: "agent-1",
      token: "invite-token",
      status: "converted",
      token_expires_at: "2099-01-01T00:00:00.000Z",
      created_at: now,
      updated_at: now,
      opened_at: now,
      lead_id: "lead-1",
      draft_payload: null
    }
    const settings = {
      agent_id: "agent-1",
      brand_name: "ShowReady",
      brand_color: "#111111",
      accent_color: "#0ea5e9",
      show_threshold: 7,
      email_notifications_enabled: true,
      question_template_id: "template-1"
    }
    const pendingLead = {
      id: "lead-1",
      agent_id: "agent-1",
      intake_type: "sale",
      buyer_name: "Taylor Verify",
      buyer_phone: null,
      buyer_email: "taylor@example.com",
      token: "invite-token",
      token_expires_at: "2099-01-01T00:00:00.000Z",
      status: "draft",
      pipeline_stage: "new",
      submitted_at: null,
      score: null,
      recommendation: null,
      summary: null,
      created_at: now,
      updated_at: now,
      reviewed_at: null,
      reviewed_stage: null
    }
    const submittedLead = {
      ...pendingLead,
      status: "submitted",
      submitted_at: now,
      score: 8.8,
      recommendation: "show",
      summary: "Ready buyer. Invite them to a showing."
    }
    const insertedAnswers: unknown[] = []
    const rpc = vi.fn(async (name: string) => {
      if (name === "finalize_submitted_invite") {
        return { data: submittedLead, error: null }
      }

      return { data: null, error: new Error(`Unexpected RPC: ${name}`) }
    })

    function createQuery(table: string) {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        delete: vi.fn(() => query),
        update: vi.fn(() => query),
        insert: vi.fn(async (row: unknown) => {
          if (table === "lead_answers") {
            insertedAnswers.push(row)
          }

          return { error: null }
        }),
        upsert: vi.fn(async () => ({
          error: new Error("there is no unique or exclusion constraint matching the ON CONFLICT specification")
        })),
        maybeSingle: vi.fn(async () => {
          if (table === "invites") {
            return { data: invite, error: null }
          }

          if (table === "leads") {
            return { data: { status: "draft" }, error: null }
          }

          return { data: null, error: null }
        }),
        single: vi.fn(async () => {
          if (table === "leads") {
            return { data: pendingLead, error: null }
          }

          if (table === "agent_settings") {
            return { data: settings, error: null }
          }

          return { data: null, error: null }
        }),
        then: (onfulfilled?: (value: unknown) => unknown) => {
          if (table === "lead_answers") {
            return Promise.resolve({ data: [], error: null }).then(onfulfilled)
          }

          if (table === "lead_scores") {
            return Promise.resolve({ data: [], error: null }).then(onfulfilled)
          }

          return Promise.resolve({ data: [], error: null }).then(onfulfilled)
        }
      }

      return query
    }

    const from = vi.fn((table: string) => createQuery(table))
    const draft = {
      contact: {
        fullName: "Taylor Verify",
        email: "taylor@example.com"
      },
      intent: "buy" as const,
      buyer: {
        buyingFor: "myself" as const,
        timeline: "within_1_month" as const,
        budgetKnowledge: "know_it" as const,
        mortgageStatus: "pre_approved" as const,
        neighborhoods: "Toronto",
        propertyType: ["condo" as const]
      }
    }

    await submitInvite({ from, rpc } as never, "invite-token", { draft })

    expect(insertedAnswers).toHaveLength(1)
    expect(insertedAnswers[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lead_id: "lead-1",
          question_key: "contact.fullName"
        }),
        expect.objectContaining({
          lead_id: "lead-1",
          question_key: "buyer.timeline"
        })
      ])
    )
    expect(rpc).toHaveBeenCalledWith(
      "finalize_submitted_invite",
      expect.objectContaining({
        p_lead_id: "lead-1"
      })
    )
  })
})
