import { describe, expect, it } from "vitest"
import type { IntakeSubmission } from "@showready/contracts"
import { scoreLead } from "../src/scoring"

describe("scoreLead", () => {
  it("scores a strong buyer lead into show", () => {
    const submission: IntakeSubmission = {
      contact: {
        fullName: "Taylor Buyer",
        email: "taylor@example.com"
      },
      intent: "buy",
      buyer: {
        buyingFor: "myself",
        timeline: "within_1_month",
        budgetKnowledge: "know_it",
        mortgageStatus: "pre_approved",
        neighborhoods: "Riverdale",
        propertyType: ["detached", "townhouse"],
        bedrooms: "3",
        bathrooms: "2",
        mustHaves: ["parking", "near_school"]
      }
    }

    const result = scoreLead(submission)

    expect(result.recommendation).toBe("show")
    expect(result.total).toBeGreaterThanOrEqual(8)
    expect(result.nextAction).toContain("buyer consultation")
  })

  it("continues to score legacy scalar buyer property type answers", () => {
    const submission: IntakeSubmission = {
      contact: {
        fullName: "Taylor Buyer",
        email: "taylor@example.com"
      },
      intent: "buy",
      buyer: {
        buyingFor: "myself",
        timeline: "within_1_month",
        budgetKnowledge: "know_it",
        mortgageStatus: "pre_approved",
        neighborhoods: "Riverdale",
        propertyType: "detached",
        bedrooms: "3"
      } as unknown as Extract<IntakeSubmission, { intent: "buy" }>["buyer"]
    }

    const result = scoreLead(submission)

    expect(result.breakdown.clarity).toBeGreaterThan(7)
  })

  it("scores buyer clarity from selected property type arrays", () => {
    const submission: IntakeSubmission = {
      contact: {
        fullName: "Avery Buyer",
        email: "avery@example.com"
      },
      intent: "buy",
      buyer: {
        buyingFor: "myself",
        timeline: "1_3_months",
        budgetKnowledge: "rough_idea",
        mortgageStatus: "not_yet",
        neighborhoods: "Leslieville",
        propertyType: ["condo", "semi_detached"],
        bedrooms: "2",
        bathrooms: "2"
      }
    }

    const result = scoreLead(submission)

    expect(result.breakdown.clarity).toBe(10)
  })

  it("keeps an exploratory rental lead in hold", () => {
    const submission: IntakeSubmission = {
      contact: {
        fullName: "Riley Renter",
        phone: "555-1111"
      },
      intent: "rent",
      rental: {
        moveTimeline: "exploring",
        rentRange: "",
        neighborhoods: "",
        placeType: [],
        bedrooms: "1",
        hasPets: "no",
        occupantCount: "1",
        incomeProof: "no"
      }
    }

    const result = scoreLead(submission)

    expect(result.recommendation).toBe("hold")
    expect(result.total).toBeLessThan(5)
    expect(result.summary).toContain("Recommended path")
  })

  it("scores rental clarity from selected place type arrays", () => {
    const submission: IntakeSubmission = {
      contact: {
        fullName: "Riley Renter",
        phone: "555-1111"
      },
      intent: "rent",
      rental: {
        moveTimeline: "within_1_month",
        rentRange: "$2,500",
        neighborhoods: "King West",
        placeType: ["condo", "apartment"],
        bedrooms: "1",
        hasPets: "no",
        occupantCount: "1"
      }
    }

    const result = scoreLead(submission)

    expect(result.breakdown.clarity).toBe(10)
  })

  it("continues to score legacy scalar rental place type answers", () => {
    const submission: IntakeSubmission = {
      contact: {
        fullName: "Riley Renter",
        phone: "555-1111"
      },
      intent: "rent",
      rental: {
        moveTimeline: "within_1_month",
        rentRange: "$2,500",
        neighborhoods: "King West",
        placeType: "house",
        bedrooms: "1",
        hasPets: "no",
        occupantCount: "1"
      } as unknown as Extract<IntakeSubmission, { intent: "rent" }>["rental"]
    }

    const result = scoreLead(submission)

    expect(result.breakdown.clarity).toBe(10)
  })
})
