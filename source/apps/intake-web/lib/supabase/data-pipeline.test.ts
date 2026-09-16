import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({
  unstable_cache: (loader: unknown) => loader
}))

import {
  listAppointmentEligibleLeadSuggestions,
  listLeads,
  listPipelineLeads
} from "./data"

type LeadRow = {
  id: string
  agent_id: string
  intake_type: "sale" | "rental" | null
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  token: string
  token_expires_at: string
  status: "submitted"
  pipeline_stage:
    | "new"
    | "ready_to_show"
    | "appointment_booked"
    | "nurture"
    | "hold"
    | "closed_won"
    | "closed_lost"
    | "archived"
  submitted_at: string
  score: number
  recommendation: "show" | "nurture" | "hold"
  summary: string
  created_at: string
  updated_at: string
  reviewed_at?: string | null
  reviewed_stage?: "ready_to_show" | "nurture" | "hold" | null
}

type AppointmentRow = {
  lead_id: string
  agentId: string
  date: string
  start_time: string
  status: "scheduled" | "completed" | "cancelled"
}

type ContactInteractionRow = {
  id: string
  lead_id: string
  agent_id: string
  method: "call" | "text" | "email"
  occurred_at: string
}

type Filter = {
  column: string
  value: unknown
}

type SelectOptions = { count?: "exact" | "planned"; head?: boolean }

type QueryCallLog = {
  selectCalls: Array<{ table: string; columns: string; options?: SelectOptions }>
  limitCalls: Array<{ table: string; count: number }>
  rangeCalls: Array<{ table: string; from: number; to: number }>
  orCalls: Array<{ table: string; filters: string }>
}

const FUTURE_DATE = "2099-01-02"
const FUTURE_TIMESTAMP = `${FUTURE_DATE}T12:00:00.000Z`

function leadRow(input: Partial<LeadRow> & Pick<LeadRow, "id" | "pipeline_stage">): LeadRow {
  return {
    id: input.id,
    agent_id: input.agent_id ?? "agent-1",
    intake_type: input.intake_type === undefined ? "sale" : input.intake_type,
    buyer_name: input.buyer_name ?? input.id,
    buyer_email: input.buyer_email ?? `${input.id}@example.com`,
    buyer_phone: input.buyer_phone ?? "+1 416 555 0100",
    token: input.token ?? `${input.id}-token`,
    token_expires_at: input.token_expires_at ?? "2099-01-01T00:00:00.000Z",
    status: "submitted",
    pipeline_stage: input.pipeline_stage,
    submitted_at: input.submitted_at ?? FUTURE_TIMESTAMP,
    score: input.score ?? 8,
    recommendation: input.recommendation ?? "show",
    summary: input.summary ?? "Lead summary",
    created_at: input.created_at ?? FUTURE_TIMESTAMP,
    updated_at: input.updated_at ?? FUTURE_TIMESTAMP,
    reviewed_at: input.reviewed_at ?? null,
    reviewed_stage: input.reviewed_stage ?? null
  }
}

class FakeQueryBuilder {
  private eqFilters: Filter[] = []
  private inFilters: Array<{ column: string; values: unknown[] }> = []
  private orFilters: string[] = []
  private limitCount: number | undefined
  private rangeBounds: { from: number; to: number } | undefined
  private selectOptions: SelectOptions | undefined

  constructor(
    private readonly table: string,
    private readonly leadRows: LeadRow[],
    private readonly appointmentRows: AppointmentRow[],
    private readonly contactRows: ContactInteractionRow[],
    private readonly callLog: QueryCallLog,
    private readonly contactError?: { code: string; message: string }
  ) {}

  select(columns: string, options?: SelectOptions) {
    this.selectOptions = options
    this.callLog.selectCalls.push({ table: this.table, columns, options })
    return this
  }

  eq(column: string, value: unknown) {
    this.eqFilters.push({ column, value })
    return this
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values })
    return this
  }

  gte() {
    return this
  }

  lte() {
    return this
  }

  lt() {
    return this
  }

  order() {
    return this
  }

  limit(count: number) {
    this.limitCount = count
    this.callLog.limitCalls.push({ table: this.table, count })
    return this
  }

  range(from: number, to: number) {
    this.rangeBounds = { from, to }
    this.callLog.rangeCalls.push({ table: this.table, from, to })
    return this
  }

  or(filters: string) {
    this.orFilters.push(filters)
    this.callLog.orCalls.push({ table: this.table, filters })
    return this
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute() {
    if (this.table === "appointments") {
      return this.executeAppointments()
    }

    if (this.table === "lead_contact_interactions") {
      return this.executeContactInteractions()
    }

    return this.executeLeads()
  }

  private executeLeads() {
    let rows = [...this.leadRows]

    if (this.orFilters.some((filter) => filter.includes("recommendation.ilike"))) {
      return {
        data: null,
        error: {
          code: "42883",
          message: "operator does not exist: recommendation ~~* unknown"
        },
        count: null
      }
    }

    for (const filter of this.eqFilters) {
      if (filter.column === "agent_id") {
        rows = rows.filter((row) => row.agent_id === filter.value)
      }

      if (filter.column === "pipeline_stage") {
        rows = rows.filter((row) => row.pipeline_stage === filter.value)
      }

      if (filter.column === "intake_type") {
        rows = rows.filter((row) => row.intake_type === filter.value)
      }
    }

    for (const filter of this.inFilters) {
      if (filter.column === "pipeline_stage") {
        rows = rows.filter((row) => filter.values.includes(row.pipeline_stage))
      }

      if (filter.column === "id") {
        rows = rows.filter((row) => filter.values.includes(row.id))
      }
    }

    for (const filter of this.orFilters) {
      if (filter === "intake_type.eq.sale,intake_type.is.null") {
        rows = rows.filter((row) => row.intake_type === "sale" || row.intake_type === null)
        continue
      }

      rows = rows.filter((row) => filter.split(",").some((expression) => this.matchesSearch(row, expression)))
    }

    const count = rows.length

    if (this.selectOptions?.head) {
      return { data: null, error: null, count }
    }

    if (this.rangeBounds) {
      rows = rows.slice(this.rangeBounds.from, this.rangeBounds.to + 1)
    } else if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount)
    }

    return { data: rows, error: null, count }
  }

  private matchesSearch(row: LeadRow, expression: string) {
    const equalsMatch = /^([a-z_]+)\.eq\.([a-z_]+)$/.exec(expression)

    if (equalsMatch) {
      const [, column, expected] = equalsMatch
      return (row as unknown as Record<string, unknown>)[column] === expected
    }

    const match = /^([a-z_]+)\.ilike\.%(.*)%$/.exec(expression)

    if (!match) {
      return false
    }

    const [, column, rawTerm] = match
    const term = rawTerm.replaceAll("\\%", "%").replaceAll("\\_", "_").toLowerCase()
    const value = String((row as unknown as Record<string, unknown>)[column] ?? "").toLowerCase()

    return value.includes(term)
  }

  private executeAppointments() {
    let rows = [...this.appointmentRows]

    for (const filter of this.eqFilters) {
      if (filter.column === "status") {
        rows = rows.filter((row) => row.status === filter.value)
      }

      if (filter.column === "leads.agent_id") {
        rows = rows.filter((row) => row.agentId === filter.value)
      }

      if (filter.column === "agent_id") {
        rows = rows.filter((row) => row.agentId === filter.value)
      }
    }

    for (const filter of this.inFilters) {
      if (filter.column === "lead_id") {
        rows = rows.filter((row) => filter.values.includes(row.lead_id))
      }
    }

    if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount)
    }

    return { data: rows, error: null, count: rows.length }
  }

  private executeContactInteractions() {
    if (this.contactError) {
      return { data: null, error: this.contactError, count: null }
    }

    let rows = [...this.contactRows]

    for (const filter of this.eqFilters) {
      if (filter.column === "agent_id") {
        rows = rows.filter((row) => row.agent_id === filter.value)
      }

      if (filter.column === "lead_id") {
        rows = rows.filter((row) => row.lead_id === filter.value)
      }
    }

    for (const filter of this.inFilters) {
      if (filter.column === "lead_id") {
        rows = rows.filter((row) => filter.values.includes(row.lead_id))
      }
    }

    rows.sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))

    if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount)
    }

    return { data: rows, error: null, count: rows.length }
  }
}

function createPipelineClient(input: {
  leadRows: LeadRow[]
  appointmentRows?: AppointmentRow[]
  contactRows?: ContactInteractionRow[]
  contactError?: { code: string; message: string }
}) {
  const callLog: QueryCallLog = {
    selectCalls: [],
    limitCalls: [],
    rangeCalls: [],
    orCalls: []
  }

  return {
    selectCalls: callLog.selectCalls,
    limitCalls: callLog.limitCalls,
    rangeCalls: callLog.rangeCalls,
    orCalls: callLog.orCalls,
    from: vi.fn(
      (table: string) =>
        new FakeQueryBuilder(
          table,
          input.leadRows,
          input.appointmentRows ?? [],
          input.contactRows ?? [],
          callLog,
          input.contactError
        )
    )
  }
}

describe("listLeads", () => {
  it("keeps exact totals while fetching one extra row for pagination", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({ id: "lead-1", pipeline_stage: "ready_to_show" }),
        leadRow({ id: "lead-2", pipeline_stage: "nurture" }),
        leadRow({ id: "lead-3", pipeline_stage: "hold" })
      ]
    })

    const result = await listLeads(client as never, "agent-1", {
      scope: "all",
      limit: 2,
      offset: 0
    })

    expect(result.total).toBe(3)
    expect(result.nextOffset).toBe(2)
    expect(result.leads).toHaveLength(2)
    expect(client.selectCalls).toContainEqual({
      table: "leads",
      columns: expect.any(String),
      options: { count: "exact" }
    })
    expect(client.rangeCalls).toContainEqual({
      table: "leads",
      from: 0,
      to: 2
    })
  })

  it("matches multi-word lead searches without sending spaces into PostgREST logic filters", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "match",
          buyer_name: "Codex User B Lead",
          pipeline_stage: "ready_to_show"
        }),
        leadRow({
          id: "miss",
          buyer_name: "Codex Other Lead",
          pipeline_stage: "ready_to_show"
        })
      ]
    })

    const result = await listLeads(client as never, "agent-1", {
      scope: "all",
      query: "Codex User B Lead",
      limit: 25,
      offset: 0
    })

    expect(result.leads.map((lead) => lead.id)).toEqual(["match"])
    expect(client.orCalls).toHaveLength(4)
    expect(client.orCalls.every((call) => !call.filters.includes(" "))).toBe(true)
  })
})

describe("listAppointmentEligibleLeadSuggestions", () => {
  it("loads suggestion rows without requesting a list total", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({ id: "ready", pipeline_stage: "ready_to_show" }),
        leadRow({ id: "nurture", pipeline_stage: "nurture" }),
        leadRow({ id: "new", pipeline_stage: "new" })
      ]
    })

    const result = await listAppointmentEligibleLeadSuggestions(client as never, "agent-1", 2)

    expect(result.map((lead) => lead.id)).toEqual(["ready", "nurture"])
    expect(client.selectCalls).toContainEqual({
      table: "leads",
      columns: expect.any(String),
      options: undefined
    })
    expect(client.limitCalls).toContainEqual({
      table: "leads",
      count: 2
    })
  })
})

describe("listPipelineLeads", () => {
  it("searches recommendation terms without applying ilike to enum columns", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "recommended-nurture",
          buyer_name: "No keyword match",
          buyer_email: "person@example.com",
          summary: "Plain summary",
          pipeline_stage: "nurture",
          recommendation: "nurture"
        }),
        leadRow({
          id: "recommended-show",
          buyer_name: "No keyword match either",
          buyer_email: "other@example.com",
          summary: "Another plain summary",
          pipeline_stage: "ready_to_show",
          recommendation: "show"
        })
      ]
    })

    const result = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "all",
      query: "nurture",
      limit: 25,
      offset: 0
    })

    expect(result.leads.map((lead) => lead.id)).toEqual(["recommended-nurture"])
    expect(client.orCalls.every((call) => !call.filters.includes("recommendation.ilike"))).toBe(true)
    expect(client.orCalls.some((call) => call.filters.includes("recommendation.eq.nurture"))).toBe(true)
  })

  it("filters active pipeline leads by rent and buy categories", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "rental-ready",
          intake_type: "rental",
          pipeline_stage: "ready_to_show",
          recommendation: "show"
        }),
        leadRow({
          id: "buyer-nurture",
          intake_type: "sale",
          pipeline_stage: "nurture",
          recommendation: "nurture"
        }),
        leadRow({
          id: "legacy-buyer",
          intake_type: null,
          pipeline_stage: "hold",
          recommendation: "hold"
        }),
        leadRow({
          id: "rental-resolved",
          intake_type: "rental",
          pipeline_stage: "closed_won",
          recommendation: "show"
        })
      ]
    })

    const rentResult = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "rent",
      limit: 25,
      offset: 0
    })
    const buyResult = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "buy",
      limit: 25,
      offset: 0
    })

    expect(rentResult.leads.map((lead) => lead.id)).toEqual(["rental-ready"])
    expect(buyResult.leads.map((lead) => lead.id)).toEqual(["buyer-nurture", "legacy-buyer"])
  })

  it("includes appointment-booked leads whose display stage matches the category", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "appointment-ready",
          pipeline_stage: "appointment_booked",
          reviewed_stage: "ready_to_show",
          recommendation: "show"
        }),
        leadRow({
          id: "direct-ready",
          pipeline_stage: "ready_to_show",
          recommendation: "show"
        }),
        leadRow({
          id: "nurture",
          pipeline_stage: "nurture",
          recommendation: "nurture"
        })
      ]
    })

    const result = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "ready_to_show",
      limit: 25,
      offset: 0
    })

    expect(result.leads.map((lead) => lead.id)).toEqual([
      "appointment-ready",
      "direct-ready"
    ])
  })

  it("advances pagination by fetched rows before display-stage filtering", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "appointment-nurture",
          pipeline_stage: "appointment_booked",
          reviewed_stage: "nurture",
          recommendation: "nurture"
        }),
        leadRow({
          id: "direct-ready",
          pipeline_stage: "ready_to_show",
          recommendation: "show"
        }),
        leadRow({
          id: "direct-ready-next-page",
          pipeline_stage: "ready_to_show",
          recommendation: "show"
        })
      ]
    })

    const result = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "ready_to_show",
      limit: 2,
      offset: 0
    })

    expect(result.leads.map((lead) => lead.id)).toEqual(["direct-ready"])
    expect(result.nextOffset).toBe(2)
    expect(client.selectCalls).toContainEqual({
      table: "leads",
      columns: expect.any(String),
      options: { count: "exact" }
    })
    expect(client.rangeCalls).toContainEqual({
      table: "leads",
      from: 0,
      to: 2
    })
  })

  it("scopes upcoming appointment context to the current agent before capping rows", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "appointment-ready",
          pipeline_stage: "appointment_booked",
          reviewed_stage: "ready_to_show",
          recommendation: "show"
        })
      ],
      appointmentRows: [
        ...Array.from({ length: 75 }, (_, index) => ({
          lead_id: `other-agent-${index}`,
          agentId: "agent-2",
          date: FUTURE_DATE,
          start_time: "09:00",
          status: "scheduled" as const
        })),
        {
          lead_id: "appointment-ready",
          agentId: "agent-1",
          date: FUTURE_DATE,
          start_time: "14:30",
          status: "scheduled"
        }
      ]
    })

    const result = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "all",
      limit: 25,
      offset: 0
    })

    expect(result.leads[0]?.attentionReason).toBe(
      `Showing scheduled ${FUTURE_DATE} at 14:30.`
    )
    expect(client.selectCalls).toContainEqual({
      table: "leads",
      columns: "id",
      options: { count: "exact", head: true }
    })
  })

  it("boosts recently contacted active leads below scheduled appointments", async () => {
    const staleTimestamp = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
    const recentContact = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "appointment-ready",
          pipeline_stage: "appointment_booked",
          reviewed_stage: "ready_to_show",
          recommendation: "show",
          score: 7
        }),
        leadRow({
          id: "contacted-nurture",
          pipeline_stage: "nurture",
          recommendation: "nurture",
          score: 4,
          updated_at: staleTimestamp,
          reviewed_at: staleTimestamp,
          reviewed_stage: "nurture"
        }),
        leadRow({
          id: "regular-ready",
          pipeline_stage: "ready_to_show",
          recommendation: "show",
          score: 9
        })
      ],
      appointmentRows: [
        {
          lead_id: "appointment-ready",
          agentId: "agent-1",
          date: FUTURE_DATE,
          start_time: "14:30",
          status: "scheduled"
        }
      ],
      contactRows: [
        {
          id: "interaction-1",
          lead_id: "contacted-nurture",
          agent_id: "agent-1",
          method: "text",
          occurred_at: recentContact
        }
      ]
    })

    const result = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "all",
      limit: 25,
      offset: 0
    })

    expect(result.leads.map((lead) => lead.id)).toEqual([
      "appointment-ready",
      "contacted-nurture",
      "regular-ready"
    ])
    expect(result.leads[1]?.latestContactInteraction).toMatchObject({
      method: "text"
    })
    expect(result.leads[1]?.attentionReason).toContain("Attempted text")
  })

  it("boosts recently contacted matching leads in active filtered results", async () => {
    const olderContact = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const newerContact = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "uncontacted-nurture",
          pipeline_stage: "nurture",
          recommendation: "nurture",
          score: 9
        }),
        leadRow({
          id: "older-contacted-nurture",
          pipeline_stage: "nurture",
          recommendation: "nurture",
          score: 6
        }),
        leadRow({
          id: "newer-contacted-nurture",
          pipeline_stage: "nurture",
          recommendation: "nurture",
          score: 4
        })
      ],
      contactRows: [
        {
          id: "interaction-old",
          lead_id: "older-contacted-nurture",
          agent_id: "agent-1",
          method: "email",
          occurred_at: olderContact
        },
        {
          id: "interaction-new",
          lead_id: "newer-contacted-nurture",
          agent_id: "agent-1",
          method: "call",
          occurred_at: newerContact
        }
      ]
    })

    const result = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "nurture",
      limit: 25,
      offset: 0
    })

    expect(result.leads.map((lead) => lead.id)).toEqual([
      "newer-contacted-nurture",
      "older-contacted-nurture",
      "uncontacted-nurture"
    ])
  })

  it("does not boost recently contacted resolved leads", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "uncontacted-closed",
          pipeline_stage: "closed_won",
          recommendation: "show"
        }),
        leadRow({
          id: "contacted-closed",
          pipeline_stage: "closed_lost",
          recommendation: "hold"
        })
      ],
      contactRows: [
        {
          id: "interaction-closed",
          lead_id: "contacted-closed",
          agent_id: "agent-1",
          method: "call",
          occurred_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
        }
      ]
    })

    const result = await listPipelineLeads(client as never, "agent-1", {
      tab: "resolved",
      category: "all",
      limit: 25,
      offset: 0
    })

    expect(result.leads.map((lead) => lead.id)).toEqual([
      "uncontacted-closed",
      "contacted-closed"
    ])
  })

  it("still loads active leads when contact interactions are not installed", async () => {
    const client = createPipelineClient({
      leadRows: [
        leadRow({
          id: "ready",
          pipeline_stage: "ready_to_show",
          recommendation: "show"
        })
      ],
      contactError: {
        code: "PGRST205",
        message: "Could not find the table 'public.lead_contact_interactions' in the schema cache"
      }
    })

    const result = await listPipelineLeads(client as never, "agent-1", {
      tab: "active",
      category: "all",
      limit: 25,
      offset: 0
    })

    expect(result.leads.map((lead) => lead.id)).toEqual(["ready"])
    expect(result.leads[0]?.latestContactInteraction).toBeUndefined()
  })
})
