import { describe, expect, it } from "vitest"
import type { Lead } from "@showready/contracts"
import { buildLeadExportCsv } from "./export-csv"

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      current += "\""
      index += 1
      continue
    }

    if (character === "\"") {
      inQuotes = !inQuotes
      continue
    }

    if (character === "," && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }

    current += character
  }

  cells.push(current)
  return cells
}

function lead(input: Partial<Lead> & Pick<Lead, "id" | "buyerName" | "intakeType">): Lead {
  return {
    id: input.id,
    agentId: input.agentId ?? "agent-1",
    intakeType: input.intakeType,
    buyerName: input.buyerName,
    buyerPhone: input.buyerPhone,
    buyerEmail: input.buyerEmail,
    token: "invite-token",
    tokenExpiresAt: "2099-01-01T00:00:00.000Z",
    status: input.status ?? "submitted",
    pipelineStage: input.pipelineStage ?? "ready_to_show",
    submittedAt: input.submittedAt ?? "2026-05-02T20:30:00.000Z",
    score: input.score ?? 9,
    recommendation: input.recommendation ?? "show",
    summary: input.summary,
    createdAt: input.createdAt ?? "2026-05-01T15:15:00.000Z",
    updatedAt: input.updatedAt ?? "2026-05-03T10:00:00.000Z",
    reviewedAt: input.reviewedAt,
    reviewedStage: input.reviewedStage,
    answers: input.answers,
    customAnswers: input.customAnswers,
    scoreBreakdown: input.scoreBreakdown,
    scoreOverride: input.scoreOverride,
    review: input.review,
    contactInteractions: input.contactInteractions
  }
}

describe("buildLeadExportCsv", () => {
  it("uses a stable universal CRM-friendly header", () => {
    const csv = buildLeadExportCsv([], {
      agentFullName: "Demo Agent"
    })

    expect(csv).toBe(
      [
        "First Name,Last Name,Full Name,Email,Phone,Company,Lead Type,Source,Stage,Pipeline,Tags,Assigned Agent,Created Date,Submitted Date,ShowReady Lead ID,ShowReady Stage,ShowReady Score,ShowReady Recommendation,Timeframe,Neighborhoods,Property Type,Bedrooms,Bathrooms,Budget Or Rent Range,Financing Or Readiness,Must Haves,Worked With Another Realtor,Additional Context,Notes",
        ""
      ].join("\n")
    )
  })

  it("maps buyer lead fields, tags, notes, and quoted CSV values", () => {
    const csv = buildLeadExportCsv(
      [
        lead({
          id: "lead-buyer-1",
          buyerName: "Ava \"Ace\", Rivera",
          buyerEmail: "ava@example.com",
          buyerPhone: "+1 416 555 0100",
          intakeType: "sale",
          pipelineStage: "ready_to_show",
          score: 9,
          recommendation: "show",
          summary: "Strong buyer lead, asked for \"ASAP\" support.",
          answers: {
            contact: {
              fullName: "Ava \"Ace\", Rivera",
              email: "ava@example.com",
              phone: "+1 416 555 0100"
            },
            intent: "buy",
            buyer: {
              timeline: "1_3_months",
              neighborhoods: "Leslieville, Beaches",
              propertyType: ["condo", "townhouse"],
              bedrooms: "2+",
              bathrooms: "2",
              budgetKnowledge: "rough_idea",
              mortgageStatus: "pre_approved",
              mustHaves: ["parking", "near_transit"],
              workedWithAnotherRealtor: "no",
              additionalContext: "Needs \"parking\", flexible closing."
            }
          },
          customAnswers: {
            referral: "Instagram, ad"
          }
        })
      ],
      {
        agentFullName: "Demo Agent"
      }
    )

    const [, row] = csv.trimEnd().split("\n")
    const cells = parseCsvLine(row)

    expect(cells[0]).toBe("Ava")
    expect(cells[1]).toBe("Rivera")
    expect(cells[2]).toBe("Ava \"Ace\", Rivera")
    expect(cells[5]).toBe("Residential Client")
    expect(cells[6]).toBe("Buyer")
    expect(cells[8]).toBe("Ready to Show")
    expect(cells[10]).toBe("ShowReady; Buyer; Ready to Show; Score 9")
    expect(cells[12]).toBe("05/01/2026")
    expect(cells[13]).toBe("05/02/2026")
    expect(cells[18]).toBe("1_3_months")
    expect(cells[19]).toBe("Leslieville, Beaches")
    expect(cells[20]).toBe("condo; townhouse")
    expect(cells[23]).toBe("rough_idea")
    expect(cells[24]).toBe("pre_approved")
    expect(cells[25]).toBe("parking; near_transit")
    expect(cells[27]).toBe("Needs \"parking\", flexible closing.")
    expect(cells[28]).toContain("Strong buyer lead")
    expect(cells[28]).toContain("referral: Instagram, ad")
    expect(row).toContain("\"Ava \"\"Ace\"\", Rivera\"")
  })

  it("maps rental lead fields without placeholder values", () => {
    const csv = buildLeadExportCsv(
      [
        lead({
          id: "lead-rental-1",
          buyerName: "Morgan Tenant",
          buyerEmail: "morgan@example.com",
          intakeType: "rental",
          pipelineStage: "nurture",
          score: 6,
          recommendation: "nurture",
          answers: {
            contact: {
              fullName: "Morgan Tenant",
              email: "morgan@example.com"
            },
            intent: "rent",
            rental: {
              moveTimeline: "within_1_month",
              rentRange: "$2,500-$3,000",
              neighborhoods: "West End",
              placeType: ["condo", "apartment"],
              bedrooms: "1+",
              hasPets: "yes",
              occupantCount: "2",
              incomeProof: "discuss_later",
              mustHaves: ["laundry", "near_transit"],
              additionalContext: "Needs pet-friendly building."
            }
          }
        })
      ],
      {
        agentFullName: undefined
      }
    )

    const [, row] = csv.trimEnd().split("\n")
    const cells = parseCsvLine(row)

    expect(cells[6]).toBe("Renter")
    expect(cells[8]).toBe("Nurture")
    expect(cells[10]).toBe("ShowReady; Renter; Nurture; Score 6")
    expect(cells[11]).toBe("")
    expect(cells[18]).toBe("within_1_month")
    expect(cells[20]).toBe("condo; apartment")
    expect(cells[22]).toBe("")
    expect(cells[23]).toBe("$2,500-$3,000")
    expect(cells[24]).toBe("Income proof: discuss_later; Pets: yes; Occupants: 2")
    expect(cells[25]).toBe("laundry; near_transit")
    expect(cells[28]).not.toContain("N/A")
    expect(cells[28]).not.toContain("Unknown")
  })
})
