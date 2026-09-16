import type {
  IntakeDraft,
  IntakeIntent,
  IntakeSubmission,
  IntakeType,
  QuestionDefinition,
  QuestionTemplate
} from "@showready/contracts"
import {
  BUYER_OPTIONAL_QUESTIONS,
  BUYER_REQUIRED_QUESTIONS,
  CONTACT_QUESTIONS,
  DEFAULT_TEMPLATES,
  INTENT_QUESTION,
  RENTAL_OPTIONAL_QUESTIONS,
  RENTAL_REQUIRED_QUESTIONS
} from "@showready/contracts"

type LeadInput = {
  buyerName: string
  buyerPhone?: string
  buyerEmail?: string
  intakeType: IntakeType
}

function hasAnyContactMethod(contact: IntakeDraft["contact"]) {
  return Boolean(contact.email?.trim() || contact.phone?.trim())
}

function canCreateLeadFromDraft(draft: IntakeDraft) {
  return Boolean(draft.contact.fullName.trim()) && hasAnyContactMethod(draft.contact) && Boolean(draft.intent)
}

export function intentToIntakeType(intent: IntakeIntent): IntakeType {
  return intent === "rent" ? "rental" : "sale"
}

export function intakeTypeToIntent(intakeType: IntakeType): IntakeIntent {
  return intakeType === "rental" ? "rent" : "buy"
}

export function getRequiredQuestionsForIntent(
  intent: IntakeIntent
): QuestionDefinition[] {
  return intent === "rent" ? RENTAL_REQUIRED_QUESTIONS : BUYER_REQUIRED_QUESTIONS
}

export function getOptionalQuestionsForIntent(
  intent: IntakeIntent
): QuestionDefinition[] {
  return intent === "rent" ? RENTAL_OPTIONAL_QUESTIONS : BUYER_OPTIONAL_QUESTIONS
}

export function getDefaultTemplateForIntakeType(
  intakeType: IntakeType
): QuestionTemplate {
  return DEFAULT_TEMPLATES[intakeType]
}

export function resolveTemplateForIntakeType(
  intakeType: IntakeType,
  templates: Array<Omit<QuestionTemplate, "intakeType"> & { intakeType?: IntakeType }>
): QuestionTemplate {
  const template = templates.find((entry) => {
    if (entry.intakeType) {
      return entry.intakeType === intakeType
    }

    return intakeType === "sale"
  })

  if (!template) {
    throw new Error(`Question template not found for intake type ${intakeType}.`)
  }

  return {
    ...template,
    intakeType: template.intakeType ?? "sale"
  }
}

export function getQuestionLabel(questionKey: string): string {
  const allQuestions = [
    ...CONTACT_QUESTIONS,
    INTENT_QUESTION,
    ...BUYER_REQUIRED_QUESTIONS,
    ...BUYER_OPTIONAL_QUESTIONS,
    ...RENTAL_REQUIRED_QUESTIONS,
    ...RENTAL_OPTIONAL_QUESTIONS
  ]

  return allQuestions.find((question) => question.key === questionKey)?.label ?? questionKey
}

function assertRequiredAnswerValue(label: string, value: unknown) {
  if (Array.isArray(value) && value.length === 0) {
    throw new Error(`Missing answers for: ${label}`)
  }

  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing answers for: ${label}`)
  }
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function flattenObject(
  prefix: string,
  value: Record<string, unknown>,
  target: Record<string, string | string[]>
) {
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null || entry === "") {
      continue
    }

    if (Array.isArray(entry)) {
      if (entry.length > 0) {
        target[`${prefix}.${key}`] = entry as string[]
      }
      continue
    }

    target[`${prefix}.${key}`] = String(entry)
  }
}

export function buildLeadInputFromDraft(draft: IntakeDraft): LeadInput {
  if (!canCreateLeadFromDraft(draft) || !draft.intent) {
    throw new Error("Draft is not ready to create a lead.")
  }

  return {
    buyerName: draft.contact.fullName.trim(),
    buyerPhone: normalizeOptionalString(draft.contact.phone),
    buyerEmail: normalizeOptionalString(draft.contact.email),
    intakeType: intentToIntakeType(draft.intent)
  }
}

export function flattenDraftAnswers(draft: IntakeDraft) {
  const flattened: Record<string, string | string[]> = {}

  flattenObject("contact", draft.contact as Record<string, unknown>, flattened)

  if (draft.intent) {
    flattened.intent = draft.intent
  }

  if (draft.buyer) {
    flattenObject("buyer", draft.buyer as Record<string, unknown>, flattened)
  }

  if (draft.rental) {
    flattenObject("rental", draft.rental as Record<string, unknown>, flattened)
  }

  for (const [key, value] of Object.entries(draft.customAnswers ?? {})) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        flattened[`custom.${key}`] = value
      }
      continue
    }

    if (value) {
      flattened[`custom.${key}`] = value
    }
  }

  return flattened
}

export function assertDraftSubmissionComplete(
  draft: IntakeDraft
): asserts draft is IntakeSubmission {
  if (!canCreateLeadFromDraft(draft) || !draft.intent) {
    throw new Error("Missing answers for: contact details, intent")
  }

  const missing = getRequiredQuestionsForIntent(draft.intent)
    .filter((question) => {
      const [scope, key] = question.key.split(".")
      const value =
        scope === "buyer"
          ? draft.buyer?.[key as keyof NonNullable<typeof draft.buyer>]
          : draft.rental?.[key as keyof NonNullable<typeof draft.rental>]

      try {
        assertRequiredAnswerValue(getQuestionLabel(question.key), value)
        return false
      } catch {
        return true
      }
    })
    .map((question) => getQuestionLabel(question.key))

  if (missing.length > 0) {
    throw new Error(`Missing answers for: ${missing.join(", ")}`)
  }
}
