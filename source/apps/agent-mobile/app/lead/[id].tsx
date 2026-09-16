import { useEffect, useMemo, useState } from "react"
import { AppState, Keyboard, Platform, StyleSheet, Text, View } from "react-native"
import * as Clipboard from "expo-clipboard"
import * as Linking from "expo-linking"
import { router, useLocalSearchParams } from "expo-router"
import type { ContactMethod, Lead, LeadContactInteraction, LeadStage } from "@showready/contracts"
import { EmptyState } from "@/components/empty-state"
import { ScreenShell } from "@/components/screen-shell"
import { ActionButton } from "@/components/ui/action-button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FormField } from "@/components/ui/form-field"
import { InlineMessage } from "@/components/ui/inline-message"
import { StageChip } from "@/components/ui/stage-chip"
import { SurfaceCard } from "@/components/ui/surface-card"
import { captureDiagnosticsError } from "@/lib/diagnostics/service"
import { mobileTheme } from "@/lib/theme"
import { useMobileApi, useSession } from "@/providers/session-provider"

type ReviewStage = Extract<LeadStage, "ready_to_show" | "nurture" | "hold">
type MoveStage = Extract<
  LeadStage,
  "ready_to_show" | "nurture" | "hold" | "closed_won" | "closed_lost" | "archived"
>

const MOVE_STAGES: Array<
  MoveStage
> = ["ready_to_show", "nurture", "hold", "closed_won", "closed_lost", "archived"]
const REVIEW_STAGES: ReviewStage[] = ["ready_to_show", "nurture", "hold"]

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { workspaceVersion = 0 } = useSession()
  const api = useMobileApi()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [message, setMessage] = useState<{
    tone: "success" | "warning" | "error"
    title: string
    message: string
  } | null>(null)
  const [isStageSheetOpen, setIsStageSheetOpen] = useState(false)
  const [stageSheetMode, setStageSheetMode] = useState<"move" | "post_contact_review">("move")
  const [shouldPromptReviewOnReturn, setShouldPromptReviewOnReturn] = useState(false)
  const [isOverrideSheetOpen, setIsOverrideSheetOpen] = useState(false)
  const [overrideScore, setOverrideScore] = useState("")
  const [overrideNote, setOverrideNote] = useState("")
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      if (!id) {
        return
      }

      try {
        const result = await api.getLeadById(id)
        if (!isMounted) {
          return
        }
        setLead(result)
        setLoadState("ready")
      } catch (error) {
        if (!isMounted) {
          return
        }
        setMessage({
          tone: "error",
          title: "Unable to load lead",
          message: error instanceof Error ? error.message : "Try again."
        })
        setLoadState("error")
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [api, id, workspaceVersion])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" || !shouldPromptReviewOnReturn) {
        return
      }

      setShouldPromptReviewOnReturn(false)
      setStageSheetMode("post_contact_review")
      setIsStageSheetOpen(true)
    })

    return () => {
      subscription.remove()
    }
  }, [shouldPromptReviewOnReturn])

  const answerSections = useMemo(() => {
    if (!lead?.answers) {
      return []
    }

    const sections: Array<{ title: string; rows: Array<[string, string]> }> = []
    const { contact, buyer, rental, customAnswers } = lead.answers

    sections.push({
      title: "Contact",
      rows: Object.entries(contact)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => [labelize(key), formatAnswer(value)])
    })

    if (buyer && Object.keys(buyer).length > 0) {
      sections.push({
        title: "Buyer answers",
        rows: Object.entries(buyer)
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([key, value]) => [labelize(key), formatAnswer(value)])
      })
    }

    if (rental && Object.keys(rental).length > 0) {
      sections.push({
        title: "Rental answers",
        rows: Object.entries(rental)
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([key, value]) => [labelize(key), formatAnswer(value)])
      })
    }

    if (customAnswers && Object.keys(customAnswers).length > 0) {
      sections.push({
        title: "Custom answers",
        rows: Object.entries(customAnswers).map(([key, value]) => [labelize(key), formatAnswer(value)])
      })
    }

    return sections.filter((section) => section.rows.length > 0)
  }, [lead])

  const contactPhone = resolveContactPhone(lead)
  const phoneUrlValue = contactPhone ? formatPhoneForNativeUrl(contactPhone) : null
  const contactEmail = resolveContactEmail(lead)
  const stageOptions = stageSheetMode === "post_contact_review" ? REVIEW_STAGES : MOVE_STAGES

  async function moveLead(stage: MoveStage) {
    if (!lead) {
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      const result =
        stageSheetMode === "post_contact_review" && isReviewStage(stage)
          ? await api.reviewLead(lead.id, stage)
          : await api.moveLead(lead.id, stage)
      setLead(result.lead)
      setIsStageSheetOpen(false)
      setStageSheetMode("move")
      setMessage({
        tone: "success",
        title: "Lead updated",
        message: `Moved ${result.lead.buyerName} to ${stage.replaceAll("_", " ")}.`
      })
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to update lead",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleContactAction(input: {
    method: ContactMethod
    url: string
    copyValue: string
  }) {
    if (!lead) {
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      try {
        await Linking.openURL(input.url)
      } catch {
        await Clipboard.setStringAsync(input.copyValue)
        setMessage({
          tone: "warning",
          title: "Contact copied",
          message: "The device could not open that contact app, so the contact value was copied."
        })
      }

      const result = await api.recordLeadContactInteraction(lead.id, input.method)
      setLead((current) => appendContactInteraction(current, result.interaction))

      if (lead.pipelineStage === "new") {
        setShouldPromptReviewOnReturn(true)
      }
    } catch (error) {
      setMessage({
        tone: "warning",
        title: "Contact history unavailable",
        message: "The contact app opened, but ShowReady could not update contact history or priority."
      })
      void captureDiagnosticsError(error, {
        eventType: "error.handled",
        category: "api",
        severity: "warning",
        leadId: lead.id,
        context: {
          source: "lead-contact-action",
          method: input.method
        }
      })
    } finally {
      setBusy(false)
    }
  }

  function openStageSheet(mode: "move" | "post_contact_review" = "move") {
    setStageSheetMode(mode)
    setIsStageSheetOpen(true)
  }

  function closeStageSheet() {
    const shouldWarn =
      stageSheetMode === "post_contact_review" && lead?.pipelineStage === "new"

    setIsStageSheetOpen(false)
    setStageSheetMode("move")

    if (shouldWarn) {
      setMessage({
        tone: "warning",
        title: "Lead still in New",
        message: "This lead remains in the review queue until you choose Ready, Nurture, or Hold."
      })
    }
  }

  function openEditSheet() {
    if (!lead) {
      return
    }

    setEditName(lead.buyerName)
    setEditEmail(lead.buyerEmail ?? lead.answers?.contact.email ?? "")
    setEditPhone(lead.buyerPhone ?? lead.answers?.contact.phone ?? "")
    setEditError(null)
    setIsEditSheetOpen(true)
  }

  async function saveLeadContact() {
    if (!lead) {
      return
    }

    const buyerName = editName.trim()
    const buyerEmail = editEmail.trim()
    const buyerPhone = editPhone.trim()

    if (!buyerName) {
      setEditError("Enter the client name.")
      return
    }

    if (!buyerEmail && !buyerPhone) {
      setEditError("Add an email or phone number.")
      return
    }

    setBusy(true)
    setEditError(null)
    setMessage(null)

    try {
      const result = await api.updateLead(lead.id, {
        buyerName,
        buyerEmail: buyerEmail || undefined,
        buyerPhone: buyerPhone || undefined,
        intakeType: lead.intakeType
      })
      setLead(result.lead)
      setIsEditSheetOpen(false)
      setMessage({
        tone: "success",
        title: "Lead updated",
        message: "Client contact details were saved."
      })
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update lead.")
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteLead() {
    if (!lead) {
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      await api.deleteLead(lead.id)
      setIsDeleteSheetOpen(false)
      router.replace("/(app)/pipeline")
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to delete lead",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setBusy(false)
    }
  }

  async function saveOverride() {
    if (!lead) {
      return
    }

    const numericScore = Number(overrideScore)
    if (!Number.isFinite(numericScore) || !overrideNote.trim()) {
      setMessage({
        tone: "error",
        title: "Incomplete override",
        message: "Enter a numeric score and a note describing why you changed it."
      })
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      const result = await api.overrideLeadScore(lead.id, {
        overrideScore: numericScore,
        note: overrideNote.trim()
      })
      setLead(result.lead)
      setOverrideScore("")
      setOverrideNote("")
      setIsOverrideSheetOpen(false)
      setMessage({
        tone: "success",
        title: "Override saved",
        message: "Manual score context is now attached to this lead."
      })
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to save override",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setBusy(false)
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace("/(app)/home")
  }

  return (
    <ScreenShell
      title={lead?.buyerName ?? "Lead detail"}
      testID="lead-detail-screen"
      leadingAction={{
        icon: "chevron-left",
        label: "Back to leads",
        onPress: handleBack,
        testID: "lead-back-chevron"
      }}
    >
      {message ? (
        <InlineMessage tone={message.tone} title={message.title} message={message.message} />
      ) : null}

      {loadState === "loading" ? (
        <EmptyState title="Loading lead" body="Fetching the full submission and scoring detail." />
      ) : loadState === "error" || !lead ? (
        <EmptyState
          title="Lead unavailable"
          body="This submission may no longer be accessible in the signed-in workspace."
        />
      ) : (
        <>
          <SurfaceCard style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroMeta}>
                <Text style={styles.name}>{lead.buyerName}</Text>
                <Text style={styles.contact}>
                  {lead.buyerEmail ?? "No email"} {lead.buyerPhone ? `• ${lead.buyerPhone}` : ""}
                </Text>
                <Text style={styles.submitted}>
                  Submitted {lead.submittedAt ? formatDate(lead.submittedAt) : "recently"}
                </Text>
              </View>
              <StageChip stage={lead.pipelineStage} recommendation={lead.recommendation} />
            </View>
            {phoneUrlValue || contactEmail ? (
              <View style={styles.contactActions}>
                {phoneUrlValue ? (
                  <>
                    <View style={styles.contactActionItem}>
                      <ActionButton
                        label="Call"
                        icon="phone"
                        tone="secondary"
                        onPress={() => {
                          void handleContactAction({
                            method: "call",
                            url: `tel:${phoneUrlValue}`,
                            copyValue: contactPhone ?? phoneUrlValue
                          })
                        }}
                        disabled={busy}
                        testID="lead-contact-call-button"
                      />
                    </View>
                    <View style={styles.contactActionItem}>
                      <ActionButton
                        label="Text"
                        icon="message-circle"
                        tone="secondary"
                        onPress={() => {
                          void handleContactAction({
                            method: "text",
                            url: `sms:${phoneUrlValue}`,
                            copyValue: contactPhone ?? phoneUrlValue
                          })
                        }}
                        disabled={busy}
                        testID="lead-contact-text-button"
                      />
                    </View>
                  </>
                ) : null}
                {contactEmail ? (
                  <View style={styles.contactActionItem}>
                    <ActionButton
                      label="Email"
                      icon="mail"
                      tone="secondary"
                      onPress={() => {
                        void handleContactAction({
                          method: "email",
                          url: `mailto:${contactEmail}`,
                          copyValue: contactEmail
                        })
                      }}
                      disabled={busy}
                      testID="lead-contact-email-button"
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.score}>Score {lead.score?.toFixed(2) ?? "0.00"}</Text>
            <Text style={styles.summary}>{lead.summary ?? "Scoring summary pending."}</Text>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.sectionTitle}>Client details</Text>
            <View style={styles.actionStack}>
              <ActionButton
                label="Edit contact"
                icon="edit-3"
                tone="secondary"
                onPress={openEditSheet}
                disabled={busy}
                testID="lead-open-edit-sheet-button"
              />
              <ActionButton
                label="Delete lead"
                icon="trash-2"
                tone="danger"
                onPress={() => setIsDeleteSheetOpen(true)}
                disabled={busy}
                testID="lead-open-delete-sheet-button"
              />
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.sectionTitle}>Contact history</Text>
            {lead.contactInteractions && lead.contactInteractions.length > 0 ? (
              lead.contactInteractions.slice(0, 5).map((interaction) => (
                <View key={interaction.id} style={styles.historyRow}>
                  <Text style={styles.answerValue}>{formatContactInteractionLabel(interaction.method)}</Text>
                  <Text style={styles.copy}>{formatContactInteractionTime(interaction.occurredAt)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.copy}>No contact attempts yet</Text>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.sectionTitle}>Review context</Text>
            <Text style={styles.copy}>
              Suggested stage: {lead.review?.suggestedStage?.replaceAll("_", " ") ?? "Not available"}
            </Text>
            <Text style={styles.copy}>
              Reviewed stage: {lead.review?.reviewedStage?.replaceAll("_", " ") ?? "Not reviewed"}
            </Text>
            {lead.scoreOverride ? (
              <Text style={styles.copy} testID="lead-score-override-summary">
                Override: {lead.scoreOverride.overrideScore.toFixed(2)} with note "{lead.scoreOverride.note}"
              </Text>
            ) : null}
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.sectionTitle}>Move lead</Text>
            <View style={styles.actionStack}>
              <ActionButton
                label="Change stage"
                icon="sliders"
                onPress={() => openStageSheet("move")}
                disabled={busy}
                testID="lead-open-stage-sheet-button"
              />
              <Text style={styles.copy}>
                Current stage: {lead.pipelineStage.replaceAll("_", " ")}
              </Text>
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={styles.sectionTitle}>Override score</Text>
            <View style={styles.actionStack}>
              <Text style={styles.copy}>
                Keep manual score changes deliberate and documented.
              </Text>
              <ActionButton
                label="Adjust score"
                tone="secondary"
                icon="edit-3"
                onPress={() => setIsOverrideSheetOpen(true)}
                disabled={busy}
                testID="lead-open-override-sheet-button"
              />
            </View>
          </SurfaceCard>

          {answerSections.map((section) => (
            <SurfaceCard key={section.title}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.rows.map(([label, value]) => (
                <View key={`${section.title}-${label}`} style={styles.answerRow}>
                  <Text style={styles.answerLabel}>{label}</Text>
                  <Text style={styles.answerValue}>{value}</Text>
                </View>
              ))}
            </SurfaceCard>
          ))}
        </>
      )}
      <BottomSheet
        visible={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        title="Edit contact"
        subtitle="Update the client details shown across the review queue and pipeline."
        testID="lead-edit-sheet"
      >
        {editError ? (
          <InlineMessage
            tone="error"
            title="Unable to update lead"
            message={editError}
          />
        ) : null}
        <FormField
          label="Client name"
          value={editName}
          onChangeText={setEditName}
          placeholder="Full name"
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          testID="lead-edit-name-input"
        />
        <FormField
          label="Email"
          value={editEmail}
          onChangeText={setEditEmail}
          placeholder="client@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          testID="lead-edit-email-input"
        />
        <FormField
          label="Phone"
          value={editPhone}
          onChangeText={setEditPhone}
          placeholder="+1 416 555 0101"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          testID="lead-edit-phone-input"
        />
        <ActionButton
          label={busy ? "Saving lead..." : "Save lead"}
          onPress={() => {
            void saveLeadContact()
          }}
          disabled={busy}
          testID="lead-save-edit-button"
        />
      </BottomSheet>
      <BottomSheet
        visible={isDeleteSheetOpen}
        onClose={() => setIsDeleteSheetOpen(false)}
        title="Delete lead"
        subtitle="Remove this client record and its related showing, score, and answer data."
        testID="lead-delete-sheet"
      >
        <InlineMessage
          tone="warning"
          title="Delete client record"
          message="This removes the lead from the mobile dashboard and cannot be undone."
        />
        <ActionButton
          label={busy ? "Deleting lead..." : "Delete lead"}
          icon="trash-2"
          tone="danger"
          onPress={() => {
            void confirmDeleteLead()
          }}
          disabled={busy}
          testID="lead-confirm-delete-button"
        />
      </BottomSheet>
      <BottomSheet
        visible={isStageSheetOpen}
        onClose={closeStageSheet}
        title={stageSheetMode === "post_contact_review" ? "Review contacted lead" : "Move lead"}
        subtitle={
          stageSheetMode === "post_contact_review"
            ? "Choose where this contacted lead belongs in the active pipeline."
            : "Update the stage without expanding the main detail page."
        }
        testID="lead-stage-sheet"
      >
        <View style={styles.actions}>
          {stageOptions.map((stage) => (
            <ActionButton
              key={stage}
              label={stage.replaceAll("_", " ")}
              tone={stage === lead?.pipelineStage ? "primary" : "secondary"}
              onPress={() => {
                void moveLead(stage)
              }}
              disabled={busy}
              testID={`lead-move-${stage}`}
            />
          ))}
        </View>
      </BottomSheet>
      <BottomSheet
        visible={isOverrideSheetOpen}
        onClose={() => setIsOverrideSheetOpen(false)}
        title="Override score"
        subtitle="Use only when the automated recommendation needs explicit agent context."
        testID="lead-override-sheet"
      >
        <FormField
          label="Override score"
          value={overrideScore}
          onChangeText={setOverrideScore}
          placeholder="9.0"
          keyboardType="decimal-pad"
          autoCapitalize="none"
          autoCorrect={false}
          testID="lead-override-score-input"
        />
        <FormField
          label="Override note"
          value={overrideNote}
          onChangeText={setOverrideNote}
          placeholder="Why this score should change"
          multiline
          multilineMinHeight={Platform.OS === "android" ? 72 : undefined}
          testID="lead-override-note-input"
        />
        {Platform.OS === "ios" ? (
          <ActionButton
            label="Done editing"
            tone="secondary"
            icon="check"
            onPress={Keyboard.dismiss}
            testID="lead-override-dismiss-keyboard-button"
          />
        ) : null}
        <ActionButton
          label={busy ? "Saving override..." : "Save override"}
          onPress={() => {
            void saveOverride()
          }}
          disabled={busy}
          testID="lead-save-override-button"
        />
      </BottomSheet>
    </ScreenShell>
  )
}

function labelize(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function formatAnswer(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ")
  }

  return String(value)
}

function isReviewStage(stage: MoveStage): stage is ReviewStage {
  return REVIEW_STAGES.includes(stage as ReviewStage)
}

function appendContactInteraction(lead: Lead | null, interaction: LeadContactInteraction) {
  if (!lead) {
    return lead
  }

  const existing = lead.contactInteractions ?? []
  const nextInteractions = [
    interaction,
    ...existing.filter((current) => current.id !== interaction.id)
  ].slice(0, 5)

  return {
    ...lead,
    contactInteractions: nextInteractions
  }
}

function resolveContactPhone(lead: Lead | null) {
  return firstNonEmpty(lead?.buyerPhone, lead?.answers?.contact.phone)
}

function resolveContactEmail(lead: Lead | null) {
  return firstNonEmpty(lead?.buyerEmail, lead?.answers?.contact.email)
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value?.trim()))?.trim()
}

function formatPhoneForNativeUrl(value: string) {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, "")

  if (!digits) {
    return null
  }

  return `${trimmed.startsWith("+") ? "+" : ""}${digits}`
}

function formatContactInteractionLabel(method: ContactMethod) {
  return method === "call"
    ? "Attempted call"
    : method === "text"
      ? "Attempted text"
      : "Attempted email"
}

function formatContactInteractionTime(value: string) {
  const occurredAt = new Date(value)
  const now = new Date()
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(occurredAt)
  const dateLabel =
    occurredAt.getFullYear() === now.getFullYear() &&
    occurredAt.getMonth() === now.getMonth() &&
    occurredAt.getDate() === now.getDate()
      ? "Today"
      : new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric"
        }).format(occurredAt)

  return `${dateLabel}, ${timeLabel}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 16
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  heroMeta: {
    flex: 1,
    gap: 4
  },
  name: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  contact: {
    fontSize: 14,
    lineHeight: 20,
    color: mobileTheme.colors.mutedInk
  },
  contactActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  contactActionItem: {
    minWidth: 112,
    flexGrow: 1
  },
  submitted: {
    fontSize: 14,
    lineHeight: 20,
    color: mobileTheme.colors.mutedInk
  },
  score: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  summary: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 22,
    color: mobileTheme.colors.mutedInk
  },
  sectionTitle: {
    fontSize: mobileTheme.typography.section,
    lineHeight: 25,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  copy: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 22,
    color: mobileTheme.colors.mutedInk
  },
  actions: {
    gap: 10
  },
  actionStack: {
    gap: 10
  },
  historyRow: {
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: mobileTheme.colors.border
  },
  answerRow: {
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: mobileTheme.colors.border
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
    color: mobileTheme.colors.brandStrong
  },
  answerValue: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 22,
    color: mobileTheme.colors.ink
  }
})
