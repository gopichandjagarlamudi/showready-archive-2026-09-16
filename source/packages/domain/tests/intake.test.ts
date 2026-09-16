import { describe, expect, it } from "vitest"
import type { IntakeDraft } from "@showready/contracts"
import {
  assertDraftSubmissionComplete,
  buildLeadInputFromDraft,
  flattenDraftAnswers
} from "../src/intake"

describe("intake draft helpers", () => {
  const draft: IntakeDraft = {
    contact: {
      fullName: "Jordan Client",
      email: "jordan@example.com"
    },
    intent: "buy",
    buyer: {
      buyingFor: "myself",
      timeline: "within_1_month",
      budgetKnowledge: "rough_idea",
      mortgageStatus: "not_yet",
      neighborhoods: "Leslieville",
      propertyType: ["condo"]
    },
    customAnswers: {
      referral_source: "Instagram"
    }
  }

  it("builds lead input once draft is ready", () => {
    expect(buildLeadInputFromDraft(draft)).toEqual({
      buyerName: "Jordan Client",
      buyerEmail: "jordan@example.com",
      buyerPhone: undefined,
      intakeType: "sale"
    })
  })

  it("flattens answers for persistence", () => {
    const flattened = flattenDraftAnswers(draft)

    expect(flattened["contact.fullName"]).toBe("Jordan Client")
    expect(flattened["buyer.timeline"]).toBe("within_1_month")
    expect(flattened["custom.referral_source"]).toBe("Instagram")
  })

  it("asserts completeness for required questions", () => {
    expect(() => assertDraftSubmissionComplete(draft)).not.toThrow()
  })
})
