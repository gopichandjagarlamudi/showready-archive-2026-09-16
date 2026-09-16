import type { LeadReview, LeadStage, Recommendation } from "@showready/contracts"

export function getSuggestedStage(
  recommendation?: Recommendation
): LeadStage | undefined {
  if (!recommendation) {
    return undefined
  }

  return recommendation === "show" ? "ready_to_show" : recommendation
}

export function getLeadReviewState(input: {
  pipelineStage: LeadStage
  recommendation?: Recommendation
  reviewedAt?: string
  reviewedStage?: LeadStage
}): LeadReview {
  const suggestedStage = getSuggestedStage(input.recommendation)
  const isReviewed = Boolean(input.reviewedAt && input.reviewedStage)

  return {
    suggestedStage,
    reviewedAt: input.reviewedAt,
    reviewedStage: input.reviewedStage,
    isReviewed,
    isOverride: Boolean(
      isReviewed &&
        suggestedStage &&
        input.reviewedStage &&
        suggestedStage !== input.reviewedStage
    )
  }
}
