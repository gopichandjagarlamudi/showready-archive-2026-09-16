import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { getPublicFormConfig, getPublicLeadIntakeContext } from "./data"

function createQueryBuilder(table: string, calls: string[]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      calls.push(`${table}.maybeSingle`)

      if (table === "invites") {
        return {
          data: {
            id: "invite-1",
            agent_id: "agent-1",
            lead_id: "lead-1",
            token_expires_at: new Date(Date.now() + 60_000).toISOString(),
            draft_payload: {
              contact: { fullName: "Taylor", email: "taylor@example.com" },
              intent: "buy"
            }
          },
          error: null
        }
      }

      if (table === "leads") {
        return {
          data: {
            status: "pending"
          },
          error: null
        }
      }

      return { data: null, error: null }
    })
  }

  return builder
}

function createPublicFormConfigClient({
  agent,
  settings
}: {
  agent: {
    full_name?: string | null
    brokerage?: string | null
  }
  settings: {
    brand_name?: string | null
    brand_color?: string | null
    accent_color?: string | null
  }
}) {
  return {
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => {
          if (table === "question_templates") {
            return Promise.resolve({
              data: [
                {
                  id: "sale-template",
                  intake_type: "sale",
                  name: "Sale",
                  intro_headline: "Sale headline",
                  intro_body: "Sale body",
                  custom_questions: []
                },
                {
                  id: "rental-template",
                  intake_type: "rental",
                  name: "Rental",
                  intro_headline: "Rental headline",
                  intro_body: "Rental body",
                  custom_questions: []
                }
              ],
              error: null
            })
          }

          return builder
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "agents") {
            return { data: agent, error: null }
          }

          if (table === "agent_settings") {
            return { data: settings, error: null }
          }

          return { data: null, error: null }
        })
      }

      return builder
    })
  }
}

describe("getPublicLeadIntakeContext", () => {
  const templates = {
    sale: {
      id: "sale-template",
      intakeType: "sale" as const,
      name: "Sale",
      introHeadline: "Sale headline",
      introBody: "Sale body",
      customQuestions: []
    },
    rental: {
      id: "rental-template",
      intakeType: "rental" as const,
      name: "Rental",
      introHeadline: "Rental headline",
      introBody: "Rental body",
      customQuestions: []
    }
  }

  it("loads dynamic invite state once and delegates reusable form config to the cache loader", async () => {
    const calls: string[] = []
    const client = {
      from: vi.fn((table: string) => {
        calls.push(table)
        return createQueryBuilder(table, calls)
      })
    }
    const loadConfig = vi.fn(async (agentId: string) => ({
      branding: {},
      templates
    }))

    const context = await getPublicLeadIntakeContext(client as never, "invite-token", loadConfig)

    expect(context?.draft.contact.fullName).toBe("Taylor")
    expect(context?.questions.required).toContainEqual(
      expect.objectContaining({ key: "buyer.buyingFor" })
    )
    expect(loadConfig).toHaveBeenCalledOnce()
    expect(loadConfig).toHaveBeenCalledWith("agent-1")
    expect(client.from).toHaveBeenCalledTimes(2)
    expect(calls).toEqual(["invites", "invites.maybeSingle", "leads", "leads.maybeSingle"])
  })

  it("passes reusable public branding from the cached form config", async () => {
    const client = {
      from: vi.fn((table: string) => createQueryBuilder(table, []))
    }
    const loadConfig = vi.fn(async () => ({
      branding: {
        realtorName: "Taylor Agent",
        brandLine: "Northline Realty",
        brandColor: "#24533f",
        accentColor: "#c45f2c"
      },
      templates
    }))

    const context = await getPublicLeadIntakeContext(client as never, "invite-token", loadConfig)

    expect(context?.branding).toEqual({
      realtorName: "Taylor Agent",
      brandLine: "Northline Realty",
      brandColor: "#24533f",
      accentColor: "#c45f2c"
    })
  })
})

describe("getPublicFormConfig", () => {
  it("builds public branding from realtor name, brokerage, and accent colors", async () => {
    const client = createPublicFormConfigClient({
      agent: {
        full_name: "Taylor Agent",
        brokerage: "Northline Realty"
      },
      settings: {
        brand_name: "Northline Group",
        brand_color: "#24533f",
        accent_color: "#c45f2c"
      }
    })

    const config = await getPublicFormConfig(client as never, "agent-1")

    expect(config.branding).toEqual({
      realtorName: "Taylor Agent",
      brandLine: "Northline Realty",
      brandColor: "#24533f",
      accentColor: "#c45f2c"
    })
  })

  it("uses non-default brandName as the brand line when brokerage is missing", async () => {
    const client = createPublicFormConfigClient({
      agent: {
        full_name: "Taylor Agent",
        brokerage: ""
      },
      settings: {
        brand_name: "Northline Group",
        brand_color: "#24533f",
        accent_color: "#c45f2c"
      }
    })

    const config = await getPublicFormConfig(client as never, "agent-1")

    expect(config.branding.brandLine).toBe("Northline Group")
  })

  it("suppresses ShowReady as a realtor brand fallback", async () => {
    const client = createPublicFormConfigClient({
      agent: {
        full_name: "Taylor Agent",
        brokerage: null
      },
      settings: {
        brand_name: "ShowReady",
        brand_color: "#24533f",
        accent_color: "#c45f2c"
      }
    })

    const config = await getPublicFormConfig(client as never, "agent-1")

    expect(config.branding).toEqual({
      realtorName: "Taylor Agent",
      brandColor: "#24533f",
      accentColor: "#c45f2c"
    })
  })
})
