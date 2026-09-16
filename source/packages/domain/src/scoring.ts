import type {
  BuyerQuestionnaireAnswers,
  IntakeSubmission,
  Recommendation,
  RentalQuestionnaireAnswers,
  ScoreBreakdown,
  ScoreResult,
  WorkedWithAnotherRealtor
} from "@showready/contracts"

function normalizeMultiAnswer(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string")
  }

  return typeof value === "string" && value ? [value] : []
}

const WEIGHTS = {
  urgency: 0.26,
  finances: 0.24,
  clarity: 0.18,
  readiness: 0.18,
  fit: 0.14
} as const

function getRecommendation(
  total: number,
  showThreshold: number
): Recommendation {
  if (total >= showThreshold) {
    return "show"
  }

  if (total >= 5) {
    return "nurture"
  }

  return "hold"
}

function scoreBuyerUrgency(timeline: BuyerQuestionnaireAnswers["timeline"]) {
  switch (timeline) {
    case "asap":
      return 10
    case "within_1_month":
      return 9
    case "1_3_months":
      return 7
    case "3_6_months":
      return 4.5
    case "6_plus_months":
      return 2
    case "exploring":
      return 1
  }
}

function scoreBuyerFinances(
  budgetKnowledge: BuyerQuestionnaireAnswers["budgetKnowledge"],
  mortgageStatus: BuyerQuestionnaireAnswers["mortgageStatus"]
) {
  const budgetScore =
    budgetKnowledge === "know_it" ? 9 : budgetKnowledge === "rough_idea" ? 6 : 2
  const mortgageScore =
    mortgageStatus === "pre_approved" || mortgageStatus === "cash"
      ? 10
      : mortgageStatus === "not_yet"
        ? 3
        : 1

  return Number.parseFloat(((budgetScore + mortgageScore) / 2).toFixed(2))
}

function scoreBuyerClarity(answers: BuyerQuestionnaireAnswers) {
  let score = 4
  const propertyTypes = normalizeMultiAnswer(answers.propertyType)

  if (answers.neighborhoods.trim()) {
    score += 3
  }

  if (propertyTypes.length > 0 && !propertyTypes.includes("other")) {
    score += 2
  }

  if (answers.bedrooms?.trim()) {
    score += 0.5
  }

  if (answers.bathrooms?.trim()) {
    score += 0.5
  }

  return Math.min(10, score)
}

function scoreBuyerReadiness(
  workedWithAnotherRealtor: WorkedWithAnotherRealtor | undefined,
  buyingFor: BuyerQuestionnaireAnswers["buyingFor"]
) {
  const relationshipScore =
    workedWithAnotherRealtor === "no"
      ? 8
      : workedWithAnotherRealtor === "browsing" || workedWithAnotherRealtor === undefined
        ? 5.5
        : 3
  const purchaseIntent =
    buyingFor === "myself" ? 8 : buyingFor === "investment" ? 7 : 4.5

  return Number.parseFloat(((relationshipScore + purchaseIntent) / 2).toFixed(2))
}

function scoreBuyerFit(answers: BuyerQuestionnaireAnswers) {
  let score = 5

  score += Math.min(answers.mustHaves?.length ?? 0, 3)

  if (answers.additionalContext?.trim()) {
    score += 1
  }

  return Math.min(10, score)
}

function scoreRentalUrgency(timeline: RentalQuestionnaireAnswers["moveTimeline"]) {
  switch (timeline) {
    case "asap":
      return 10
    case "within_2_weeks":
      return 9
    case "within_1_month":
      return 8
    case "1_3_months":
      return 5
    case "exploring":
      return 1
  }
}

function scoreRentalFinances(answers: RentalQuestionnaireAnswers) {
  const incomeScore =
    answers.incomeProof === "yes"
      ? 9
      : answers.incomeProof === "discuss_later"
        ? 5
        : answers.incomeProof === "no"
          ? 2
          : 4

  const budgetScore =
    answers.rentRange.trim().length > 0
      ? answers.rentRange.includes("$")
        ? 8
        : 6
      : 1

  return Number.parseFloat(((incomeScore + budgetScore) / 2).toFixed(2))
}

function scoreRentalClarity(answers: RentalQuestionnaireAnswers) {
  let score = 4
  const placeTypes = normalizeMultiAnswer(answers.placeType)

  if (answers.neighborhoods.trim()) {
    score += 3
  }

  if (placeTypes.length > 0 && !placeTypes.includes("not_sure")) {
    score += 2
  }

  if (answers.bedrooms.trim()) {
    score += 1
  }

  return Math.min(10, score)
}

function scoreRentalReadiness(answers: RentalQuestionnaireAnswers) {
  let score =
    answers.rentedInCanadaBefore === "yes"
      ? 8
      : answers.rentedInCanadaBefore === "no"
        ? 5
        : 6

  if (answers.incomeProof === "yes") {
    score += 1
  } else if (answers.incomeProof === "no") {
    score -= 1.5
  }

  return Math.max(1, Math.min(10, score))
}

function scoreRentalFit(answers: RentalQuestionnaireAnswers) {
  let score = 5

  score += Math.min(answers.mustHaves?.length ?? 0, 3)

  if (answers.preferredMoveInDate?.trim()) {
    score += 1
  }

  if (answers.additionalContext?.trim()) {
    score += 1
  }

  return Math.min(10, score)
}

function buildBuyerBreakdown(answers: BuyerQuestionnaireAnswers): ScoreBreakdown {
  return {
    urgency: scoreBuyerUrgency(answers.timeline),
    finances: scoreBuyerFinances(
      answers.budgetKnowledge,
      answers.mortgageStatus
    ),
    clarity: scoreBuyerClarity(answers),
    readiness: scoreBuyerReadiness(
      answers.workedWithAnotherRealtor,
      answers.buyingFor
    ),
    fit: scoreBuyerFit(answers)
  }
}

function buildRentalBreakdown(answers: RentalQuestionnaireAnswers): ScoreBreakdown {
  return {
    urgency: scoreRentalUrgency(answers.moveTimeline),
    finances: scoreRentalFinances(answers),
    clarity: scoreRentalClarity(answers),
    readiness: scoreRentalReadiness(answers),
    fit: scoreRentalFit(answers)
  }
}

function getNextAction(
  submission: IntakeSubmission,
  recommendation: Recommendation
) {
  if (submission.intent === "buy") {
    if (recommendation === "show") {
      return "Book a buyer consultation and shortlist homes for an in-person showing."
    }

    if (recommendation === "nurture") {
      return "Follow up on financing and narrow neighborhoods before booking a showing."
    }

    return "Keep this buyer in nurture until timing and financing become clearer."
  }

  if (recommendation === "show") {
    return "Send rental matches now and line up viewings around the target move date."
  }

  if (recommendation === "nurture") {
    return "Confirm rental documents and preferred move-in timing before touring."
  }

  return "Keep this rental lead warm until move timing and application readiness improve."
}

function buildSummary(
  submission: IntakeSubmission,
  total: number,
  breakdown: ScoreBreakdown,
  recommendation: Recommendation
) {
  const focus =
    submission.intent === "buy"
      ? `buyer timeline ${submission.buyer.timeline.replaceAll("_", " ")}`
      : `renter timeline ${submission.rental.moveTimeline.replaceAll("_", " ")}`
  const financeNote =
    submission.intent === "buy"
      ? `financing ${submission.buyer.mortgageStatus.replaceAll("_", " ")}`
      : `income proof ${submission.rental.incomeProof?.replaceAll("_", " ") ?? "unknown"}`

  return `Score ${total}/10. Strongest signals: ${focus}, ${financeNote}, clarity ${breakdown.clarity.toFixed(1)}/10. Recommended path: ${recommendation.toUpperCase()}.`
}

export function getScoreBreakdown(submission: IntakeSubmission): ScoreBreakdown {
  return submission.intent === "buy"
    ? buildBuyerBreakdown(submission.buyer)
    : buildRentalBreakdown(submission.rental)
}

export function scoreLead(
  submission: IntakeSubmission,
  showThreshold = 8
): ScoreResult {
  const breakdown = getScoreBreakdown(submission)
  const rawScore =
    breakdown.urgency * WEIGHTS.urgency +
    breakdown.finances * WEIGHTS.finances +
    breakdown.clarity * WEIGHTS.clarity +
    breakdown.readiness * WEIGHTS.readiness +
    breakdown.fit * WEIGHTS.fit

  const total = Number.parseFloat(rawScore.toFixed(2))
  const recommendation = getRecommendation(total, showThreshold)

  return {
    total,
    breakdown,
    recommendation,
    summary: buildSummary(submission, total, breakdown, recommendation),
    nextAction: getNextAction(submission, recommendation),
    effectiveShowThreshold: showThreshold
  }
}

export const scoringConfig = {
  weights: WEIGHTS
}
