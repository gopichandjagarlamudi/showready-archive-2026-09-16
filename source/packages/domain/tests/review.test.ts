import { describe, expect, it } from "vitest"
import { getLeadReviewState, getSuggestedStage } from "../src/review"

describe("review rules", () => {
  it("maps show to ready_to_show", () => {
    expect(getSuggestedStage("show")).toBe("ready_to_show")
  })

  it("marks mismatched reviewed stage as override", () => {
    const review = getLeadReviewState({
      pipelineStage: "nurture",
      recommendation: "show",
      reviewedAt: "2026-04-19T10:00:00.000Z",
      reviewedStage: "nurture"
    })

    expect(review.isReviewed).toBe(true)
    expect(review.isOverride).toBe(true)
    expect(review.suggestedStage).toBe("ready_to_show")
  })
})
