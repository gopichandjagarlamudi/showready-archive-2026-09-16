"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import type {
  IntakeDraft,
  QuestionDefinition,
  QuestionTemplate
} from "@showready/contracts/intake-public"
import {
  getOptionalQuestionsForIntent,
  getRequiredQuestionsForIntent
} from "@showready/contracts/intake-public"
import type { PublicIntakeBranding } from "@/lib/public-intake-branding"
import { IntakeBrandedShell } from "./intake-branding"

type FlowQuestion = QuestionDefinition & {
  scope: "core" | "custom"
}

function getDraftValue(draft: IntakeDraft, key: string) {
  if (key.startsWith("contact.")) {
    const field = key.replace("contact.", "")
    return draft.contact[field as keyof typeof draft.contact] ?? ""
  }

  if (key === "intent") {
    return draft.intent ?? ""
  }

  if (key.startsWith("buyer.")) {
    const field = key.replace("buyer.", "")
    return draft.buyer?.[field as keyof NonNullable<typeof draft.buyer>] ?? ""
  }

  if (key.startsWith("rental.")) {
    const field = key.replace("rental.", "")
    return draft.rental?.[field as keyof NonNullable<typeof draft.rental>] ?? ""
  }

  if (key.startsWith("custom.")) {
    const field = key.replace("custom.", "")
    return draft.customAnswers?.[field] ?? ""
  }

  return ""
}

function setDraftValue(draft: IntakeDraft, key: string, value: string | string[]) {
  if (key.startsWith("contact.")) {
    const field = key.replace("contact.", "")
    return {
      ...draft,
      contact: {
        ...draft.contact,
        [field]: value
      }
    }
  }

  if (key === "intent") {
    return {
      ...draft,
      intent: value as "buy" | "rent"
    }
  }

  if (key.startsWith("buyer.")) {
    const field = key.replace("buyer.", "")
    return {
      ...draft,
      buyer: {
        ...draft.buyer,
        [field]: value
      }
    }
  }

  if (key.startsWith("rental.")) {
    const field = key.replace("rental.", "")
    return {
      ...draft,
      rental: {
        ...draft.rental,
        [field]: value
      }
    }
  }

  if (key.startsWith("custom.")) {
    const field = key.replace("custom.", "")
    return {
      ...draft,
      customAnswers: {
        ...draft.customAnswers,
        [field]: value
      }
    }
  }

  return draft
}

function getStringValue(value: unknown) {
  return Array.isArray(value) ? "" : String(value ?? "")
}

function getMultiSelectValues(value: unknown) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    return [value]
  }

  return []
}

function isAlreadySubmittedError(message: string) {
  return message.toLowerCase().includes("already been submitted")
}

function getInputType(type: QuestionDefinition["type"]) {
  if (type === "email" || type === "tel" || type === "date") {
    return type
  }

  return "text"
}

function persistFallbackMessage(shouldSubmit: boolean) {
  return shouldSubmit
    ? "Unable to submit intake. Check your connection and try again."
    : "Unable to save answer. Check your connection and try again."
}

const URL_LIKE_PATTERN = /\b(?:https?:\/\/|www\.)/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_ALLOWED_PATTERN = /^[+()\d\s.-]+$/

function countDigits(value: string) {
  return value.replace(/\D/g, "").length
}

function isValidPhone(value: string) {
  const trimmed = value.trim()

  return trimmed.length === 0 || (PHONE_ALLOWED_PATTERN.test(trimmed) && countDigits(trimmed) >= 7)
}

export function IntakeFlow({
  token,
  branding,
  draft: initialDraft,
  saleTemplate,
  rentalTemplate,
  requiredQuestions,
  optionalQuestions
}: {
  token: string
  branding: PublicIntakeBranding
  draft: IntakeDraft
  saleTemplate: QuestionTemplate
  rentalTemplate: QuestionTemplate
  requiredQuestions: QuestionDefinition[]
  optionalQuestions: QuestionDefinition[]
}) {
  const [draft, setDraft] = useState<IntakeDraft>(initialDraft)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [website, setWebsite] = useState("")
  const [guardStartedAt] = useState(() => Date.now())
  const autosaveSequence = useRef(0)
  const [isSubmitting, startSubmitTransition] = useTransition()

  const activeTemplate = draft.intent === "rent" ? rentalTemplate : saleTemplate
  const resolvedRequiredQuestions = draft.intent
    ? getRequiredQuestionsForIntent(draft.intent)
    : requiredQuestions
  const resolvedOptionalQuestions = draft.intent
    ? getOptionalQuestionsForIntent(draft.intent)
    : optionalQuestions
  const customQuestions = activeTemplate.customQuestions.map<FlowQuestion>((question) => ({
    key: `custom.${question.id}`,
    label: question.label,
    helperText: question.helperText,
    required: question.required,
    type: question.type,
    options: question.options,
    scope: "custom"
  }))

  const steps = useMemo<FlowQuestion[]>(
    () => [
      {
        key: "contact.fullName",
        label: "What’s your full name?",
        required: true,
        type: "text",
        scope: "core"
      },
      {
        key: "contact.phone",
        label: "What’s the best phone number to reach you?",
        required: false,
        type: "tel",
        scope: "core"
      },
      {
        key: "contact.email",
        label: "What’s the best email to reach you?",
        required: false,
        type: "email",
        scope: "core"
      },
      {
        key: "intent",
        label: "Are you buying a property or renting?",
        required: true,
        type: "single_select",
        options: [
          { label: "Buying a property", value: "buy" },
          { label: "Renting", value: "rent" }
        ],
        scope: "core"
      },
      ...resolvedRequiredQuestions.map((question) => ({ ...question, scope: "core" as const })),
      ...resolvedOptionalQuestions.map((question) => ({ ...question, scope: "core" as const })),
      ...customQuestions
    ],
    [customQuestions, resolvedOptionalQuestions, resolvedRequiredQuestions]
  )

  const current = steps[index]
  const value = getDraftValue(draft, current.key)
  const isLastStep = index === steps.length - 1
  const completionPath = `/intake/${token}/complete`

  function getCurrentValidationError() {
    if (!current.required) {
      if (current.key === "contact.phone" && typeof value === "string" && !isValidPhone(value)) {
        return "Enter a valid phone number."
      }

      if (
        current.key === "contact.email" &&
        typeof value === "string" &&
        value.trim().length > 0 &&
        !EMAIL_PATTERN.test(value.trim())
      ) {
        return "Enter a valid email address."
      }

      return null
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? null : `Please answer "${current.label}" before continuing.`
    }

    if (typeof value === "string") {
      if (value.trim().length === 0) {
        return `Please answer "${current.label}" before continuing.`
      }

      if (current.key === "contact.fullName" && URL_LIKE_PATTERN.test(value)) {
        return "Enter your name without links."
      }

      if (current.key === "contact.phone" && !isValidPhone(value)) {
        return "Enter a valid phone number."
      }

      if (current.key === "contact.email" && !EMAIL_PATTERN.test(value.trim())) {
        return "Enter a valid email address."
      }

      return null
    }

    return value ? null : `Please answer "${current.label}" before continuing.`
  }

  async function sendDraft(nextDraft: IntakeDraft, shouldSubmit = false) {
    const response = await fetch(
      shouldSubmit
        ? `/api/intake/${token}/submit`
        : `/api/intake/${token}/autosave`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          draft: nextDraft,
          guard: {
            startedAt: guardStartedAt,
            website
          }
        })
      }
    )

    const payload = await response
      .json()
      .catch(() => ({ error: persistFallbackMessage(shouldSubmit) }))

    if (!response.ok) {
      return {
        ok: false as const,
        error: payload.error ?? persistFallbackMessage(shouldSubmit)
      }
    }

    return { ok: true as const }
  }

  function persistAutosave(nextDraft: IntakeDraft) {
    setError(null)
    setIndex((previous) => Math.min(previous + 1, steps.length - 1))

    const sequence = autosaveSequence.current + 1
    autosaveSequence.current = sequence

    void sendDraft(nextDraft)
      .then((result) => {
        if (sequence !== autosaveSequence.current) {
          return
        }

        if (!result.ok) {
          setError(result.error)
        }
      })
      .catch(() => {
        if (sequence === autosaveSequence.current) {
          setError(persistFallbackMessage(false))
        }
      })
  }

  function persistSubmit(nextDraft: IntakeDraft) {
    setError(null)
    startSubmitTransition(async () => {
      try {
        const result = await sendDraft(nextDraft, true)

        if (!result.ok) {
          if (isAlreadySubmittedError(result.error)) {
            window.location.assign(completionPath)
            return
          }

          setError(result.error)
          return
        }

        window.location.assign(completionPath)
      } catch {
        setError(persistFallbackMessage(true))
      }
    })
  }

  function handleAdvance() {
    const validationError = getCurrentValidationError()

    if (validationError) {
      setError(validationError)
      return
    }

    if (
      current.key === "contact.email" &&
      !draft.contact.email?.trim() &&
      !draft.contact.phone?.trim()
    ) {
      setError("Please add at least one contact method before continuing.")
      return
    }

    if (isLastStep) {
      persistSubmit(draft)
      return
    }

    persistAutosave(draft)
  }

  function handleSkip() {
    if (current.required) {
      return
    }

    if (isLastStep) {
      persistSubmit(draft)
      return
    }

    persistAutosave(draft)
  }

  return (
    <IntakeBrandedShell branding={branding}>
      <div className="intake-header">
        <p className="intake-eyebrow">{activeTemplate.name}</p>
        <h1 className="intake-title">{activeTemplate.introHeadline}</h1>
        <p className="intake-copy">{activeTemplate.introBody}</p>
        <div className="intake-progress-track">
          <div
            className="intake-progress-bar"
            style={{
              width: `${((index + 1) / steps.length) * 100}%`
            }}
          />
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleAdvance()
        }}
        className="intake-form"
      >
          <div>
            <p className="intake-step-label">
              Step {index + 1} of {steps.length}
            </p>
            <h2 className="intake-question">{current.label}</h2>
            {current.helperText ? (
              <p className="intake-copy">{current.helperText}</p>
            ) : null}
          </div>

          {current.type === "single_select" ? (
            <div className="intake-options">
              {current.options?.map((option) => {
                const isActive = value === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setDraft((previous) => setDraftValue(previous, current.key, option.value))
                    }
                    className={`intake-option${isActive ? " intake-option-active" : ""}`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          ) : current.type === "multi_select" ? (
            <div className="intake-options">
              {current.options?.map((option) => {
                const currentValues = getMultiSelectValues(value)
                const isActive = currentValues.includes(option.value)

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      const nextValues = isActive
                        ? currentValues.filter((entry) => entry !== option.value)
                        : [...currentValues, option.value]
                      setDraft((previous) => setDraftValue(previous, current.key, nextValues))
                    }}
                    className={`intake-option${isActive ? " intake-option-active" : ""}`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          ) : current.type === "textarea" ? (
            <textarea
              rows={5}
              value={getStringValue(value)}
              aria-label={current.label}
              onChange={(event) =>
                setDraft((previous) => setDraftValue(previous, current.key, event.target.value))
              }
              className="intake-control intake-textarea"
            />
          ) : (
            <input
              type={getInputType(current.type)}
              value={getStringValue(value)}
              placeholder={current.placeholder}
              aria-label={current.label}
              enterKeyHint={isLastStep ? "done" : "next"}
              onChange={(event) =>
                setDraft((previous) => setDraftValue(previous, current.key, event.target.value))
              }
              className="intake-control"
            />
          )}

          <input
            type="text"
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="intake-honeypot"
            aria-hidden="true"
          />

          {error ? (
            <div className="intake-error">{error}</div>
          ) : null}

          <div className="intake-actions">
            <button type="submit" disabled={isSubmitting} className="intake-primary">
              {isSubmitting ? "Submitting..." : isLastStep ? "Submit" : "Continue"}
            </button>
            {!current.required ? (
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSubmitting}
                className="intake-secondary"
              >
                Skip
              </button>
            ) : null}
          </div>
      </form>
    </IntakeBrandedShell>
  )
}
