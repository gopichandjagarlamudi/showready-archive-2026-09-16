import DateTimePicker from "@react-native-community/datetimepicker"
import { useEffect, useMemo, useState } from "react"
import { Feather } from "@expo/vector-icons"
import * as Linking from "expo-linking"
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native"
import { EmptyState } from "@/components/empty-state"
import { ScreenShell } from "@/components/screen-shell"
import { ActionButton } from "@/components/ui/action-button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FormField } from "@/components/ui/form-field"
import { InlineMessage } from "@/components/ui/inline-message"
import { SurfaceCard } from "@/components/ui/surface-card"
import { getLegalUrl, type LegalLinkKey } from "@/lib/legal"
import { shareCsvFile } from "@/lib/share-csv"
import { mobileTheme } from "@/lib/theme"
import { useMobileApi, useSession } from "@/providers/session-provider"

type FormState = {
  fullName: string
  brokerage: string
  licenseNumber: string
  emailNotificationsEnabled: boolean
}
type ExportPicker = "from" | "to" | null

const emptyForm: FormState = {
  fullName: "",
  brokerage: "",
  licenseNumber: "",
  emailNotificationsEnabled: false
}

function padNumber(value: number) {
  return String(value).padStart(2, "0")
}

function formatApiDate(value: Date) {
  return `${value.getFullYear()}-${padNumber(value.getMonth() + 1)}-${padNumber(value.getDate())}`
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value)
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"
}

export default function SettingsScreen() {
  const { session, signOut } = useSession()
  const api = useMobileApi()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [savedForm, setSavedForm] = useState<FormState>(emptyForm)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [message, setMessage] = useState<{
    tone: "success" | "error"
    title: string
    message: string
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [feedbackNotice, setFeedbackNotice] = useState<{
    tone: "success" | "error"
    title: string
    message: string
  } | null>(null)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false)
  const [exportFromDate, setExportFromDate] = useState(() => addDays(new Date(), -30))
  const [exportToDate, setExportToDate] = useState(() => new Date())
  const [exportPicker, setExportPicker] = useState<ExportPicker>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportNotice, setExportNotice] = useState<{
    tone: "success" | "warning" | "error"
    title: string
    message: string
  } | null>(null)
  const [isDeletionSheetOpen, setIsDeletionSheetOpen] = useState(false)
  const [deletionNote, setDeletionNote] = useState("")
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false)
  const [deletionNotice, setDeletionNotice] = useState<{
    tone: "success" | "error"
    title: string
    message: string
  } | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  )
  const exportFromApiDate = formatApiDate(exportFromDate)
  const exportToApiDate = formatApiDate(exportToDate)

  useEffect(() => {
    let isMounted = true

    api
      .getSettings()
      .then((settings: {
        fullName: string
        brokerage?: string
        licenseNumber?: string
        emailNotificationsEnabled: boolean
      }) => {
        if (!isMounted) {
          return
        }

        const nextForm = {
          fullName: settings.fullName,
          brokerage: settings.brokerage ?? "",
          licenseNumber: settings.licenseNumber ?? "",
          emailNotificationsEnabled: settings.emailNotificationsEnabled
        } satisfies FormState

        setForm(nextForm)
        setSavedForm(nextForm)
        setLoadState("ready")
      })
      .catch((error: Error) => {
        if (!isMounted) {
          return
        }

        setMessage({
          tone: "error",
          title: "Unable to load settings",
          message: error.message
        })
        setLoadState("error")
      })

    return () => {
      isMounted = false
    }
  }, [api])

  async function save() {
    if (!form.fullName.trim()) {
      setMessage({
        tone: "error",
        title: "Full name required",
        message: "Add the full name that should appear across the mobile workspace."
      })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      await api.saveSettings({
        fullName: form.fullName.trim(),
        brokerage: form.brokerage.trim(),
        licenseNumber: form.licenseNumber.trim(),
        emailNotificationsEnabled: form.emailNotificationsEnabled
      })
      const nextSaved = {
        fullName: form.fullName.trim(),
        brokerage: form.brokerage.trim(),
        licenseNumber: form.licenseNumber.trim(),
        emailNotificationsEnabled: form.emailNotificationsEnabled
      }
      setForm(nextSaved)
      setSavedForm(nextSaved)
      setMessage({
        tone: "success",
        title: "Settings saved",
        message: "Your mobile profile is aligned with the backend workspace."
      })
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to save settings",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    setMessage(null)

    try {
      await signOut()
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to sign out",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  async function submitFeedback() {
    const message = feedback.trim()

    if (!message) {
      setFeedbackNotice({
        tone: "error",
        title: "Feedback required",
        message: "Share what to improve or which feature would help your workflow."
      })
      return
    }

    setIsSubmittingFeedback(true)
    setFeedbackNotice(null)

    try {
      await api.submitFeedback({ message })
      setFeedback("")
      setFeedbackNotice({
        tone: "success",
        title: "Feedback sent",
        message: "Thanks. Your feedback has been saved for the ShowReady team."
      })
    } catch (error) {
      setFeedbackNotice({
        tone: "error",
        title: "Unable to send feedback",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  function handleExportDateChange(picker: Exclude<ExportPicker, null>) {
    return (event: { type?: string }, nextValue?: Date) => {
      if (event?.type === "dismissed" || !nextValue) {
        if (Platform.OS !== "ios") {
          setExportPicker(null)
        }
        return
      }

      if (picker === "from") {
        setExportFromDate(nextValue)
      } else {
        setExportToDate(nextValue)
      }

      if (Platform.OS !== "ios") {
        setExportPicker(null)
      }
    }
  }

  async function exportLeadData() {
    if (exportFromApiDate > exportToApiDate) {
      setExportNotice({
        tone: "error",
        title: "Date range invalid",
        message: "Choose a from date that is on or before the to date."
      })
      return
    }

    setIsExporting(true)
    setExportNotice(null)

    try {
      const result = await api.exportLeadsCsv({
        fromDate: exportFromApiDate,
        toDate: exportToApiDate,
        timeZone: getDeviceTimeZone()
      })

      if (result.rowCount === 0) {
        setExportNotice({
          tone: "warning",
          title: "No leads found",
          message: "No submitted leads found for that date range."
        })
        return
      }

      await shareCsvFile({
        fileName: result.fileName,
        csv: result.csv
      })
      setExportNotice({
        tone: "success",
        title: "CSV ready",
        message: `${result.rowCount} submitted lead${result.rowCount === 1 ? "" : "s"} exported.`
      })
    } catch (error) {
      setExportNotice({
        tone: "error",
        title: "Unable to export leads",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setIsExporting(false)
    }
  }

  async function openLegalLink(key: LegalLinkKey) {
    try {
      await Linking.openURL(getLegalUrl(key))
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to open link",
        message: error instanceof Error ? error.message : "Try again."
      })
    }
  }

  async function requestAccountDeletion() {
    setIsRequestingDeletion(true)
    setDeletionNotice(null)

    try {
      await api.requestAccountDeletion({
        note: deletionNote.trim() || undefined
      })
      setDeletionNote("")
      setDeletionNotice({
        tone: "success",
        title: "Deletion request sent",
        message: "Support will verify and process the account and workspace deletion request."
      })
    } catch (error) {
      setDeletionNotice({
        tone: "error",
        title: "Unable to request deletion",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setIsRequestingDeletion(false)
    }
  }

  return (
    <ScreenShell
      title="Settings"
      testID="settings-screen"
    >
      <SurfaceCard style={styles.identityCard}>
        <Text style={styles.identityEmail}>{session?.user.email ?? "Unknown email"}</Text>
        <ActionButton
          label={isSigningOut ? "Signing out..." : "Sign out"}
          tone="danger"
          icon="log-out"
          onPress={() => {
            void handleSignOut()
          }}
          disabled={isSigningOut}
          testID="settings-sign-out-button"
        />
      </SurfaceCard>

      {message ? (
        <InlineMessage tone={message.tone} title={message.title} message={message.message} />
      ) : null}

      {loadState === "loading" ? (
        <EmptyState title="Loading settings" body="Pulling the current profile from Supabase." />
      ) : loadState === "error" ? (
        <EmptyState
          title="Settings unavailable"
          body="Try again once the workspace reconnects."
        />
      ) : (
        <>
          <SurfaceCard style={styles.formCard}>
            <FormField
              label="Full name"
              value={form.fullName}
              onChangeText={(fullName: string) => setForm((current) => ({ ...current, fullName }))}
              placeholder="Demo Agent"
              textContentType="name"
              autoComplete="name"
              testID="settings-full-name-input"
            />
            <FormField
              label="Brokerage"
              value={form.brokerage}
              onChangeText={(brokerage: string) => setForm((current) => ({ ...current, brokerage }))}
              placeholder="Northline Realty"
              textContentType="organizationName"
              testID="settings-brokerage-input"
            />
            <FormField
              label="License number"
              value={form.licenseNumber}
              onChangeText={(licenseNumber: string) =>
                setForm((current) => ({ ...current, licenseNumber }))
              }
              placeholder="SR-2026-001"
              testID="settings-license-number-input"
            />
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceCopy}>
                <Text style={styles.preferenceTitle}>Also send email notification</Text>
              </View>
              <Switch
                testID="settings-email-notifications-toggle"
                value={form.emailNotificationsEnabled}
                onValueChange={(emailNotificationsEnabled: boolean) =>
                  setForm((current) => ({ ...current, emailNotificationsEnabled }))
                }
                trackColor={{
                  false: mobileTheme.colors.borderStrong,
                  true: mobileTheme.colors.brand
                }}
              />
            </View>

            <ActionButton
              label={isSaving ? "Saving settings..." : "Save settings"}
              onPress={() => {
                void save()
              }}
              disabled={isSaving || !isDirty}
              testID="settings-save-button"
            />
          </SurfaceCard>

          <SurfaceCard style={styles.exportCard}>
            <View style={styles.exportHeaderRow}>
              <View style={styles.exportTitleGroup}>
                <Text style={styles.preferenceTitle}>Lead Data Export</Text>
                <Text style={styles.exportMeta}>
                  Submitted leads only
                </Text>
              </View>
              <ActionButton
                label="Export lead data"
                icon="download"
                tone="secondary"
                onPress={() => {
                  setExportNotice(null)
                  setIsExportSheetOpen(true)
                }}
                testID="settings-open-export-sheet-button"
              />
            </View>
          </SurfaceCard>

          <SurfaceCard style={styles.legalCard}>
            <View style={styles.exportTitleGroup}>
              <Text style={styles.preferenceTitle}>Privacy & Legal</Text>
              <Text style={styles.legalBody}>
                ShowReady collects account profile details, lead and client contact details,
                intake answers, appointments, notification tokens, consent/audit records,
                first-party product events, and diagnostics.
              </Text>
              <Text style={styles.legalBody}>
                This data is used to authenticate your account, run lead workflows, send requested
                notifications, export or delete data, secure the service, and troubleshoot issues.
              </Text>
              <Text style={styles.legalBody}>
                Auth sessions use secure device storage where available. ShowReady does not sell
                data or use third-party advertising tracking.
              </Text>
            </View>
            <View style={styles.legalLinkGrid}>
              <ActionButton
                label="Privacy Policy"
                icon="shield"
                tone="secondary"
                onPress={() => {
                  void openLegalLink("privacy")
                }}
                testID="settings-open-privacy-policy-button"
              />
              <ActionButton
                label="Terms of Use"
                icon="file-text"
                tone="secondary"
                onPress={() => {
                  void openLegalLink("terms")
                }}
                testID="settings-open-terms-button"
              />
              <ActionButton
                label="Support"
                icon="mail"
                tone="secondary"
                onPress={() => {
                  void openLegalLink("support")
                }}
                testID="settings-open-support-button"
              />
              <ActionButton
                label="Web deletion request"
                icon="external-link"
                tone="secondary"
                onPress={() => {
                  void openLegalLink("accountDeletion")
                }}
                testID="settings-open-account-deletion-web-button"
              />
            </View>
            <ActionButton
              label="Request account deletion"
              icon="trash-2"
              tone="danger"
              onPress={() => {
                setDeletionNotice(null)
                setIsDeletionSheetOpen(true)
              }}
              testID="settings-open-account-deletion-sheet-button"
            />
          </SurfaceCard>

          <SurfaceCard style={styles.feedbackCard}>
            {feedbackNotice ? (
              <InlineMessage
                tone={feedbackNotice.tone}
                title={feedbackNotice.title}
                message={feedbackNotice.message}
              />
            ) : null}
            <FormField
              label="Feedback"
              value={feedback}
              onChangeText={setFeedback}
              placeholder="What should we improve or build next?"
              helperText="Share what would make ShowReady better for your real estate workflow."
              multiline
              testID="settings-feedback-input"
            />
            <ActionButton
              label={isSubmittingFeedback ? "Sending feedback..." : "Submit feedback"}
              icon="send"
              onPress={() => {
                void submitFeedback()
              }}
              disabled={isSubmittingFeedback}
              testID="settings-feedback-submit-button"
            />
          </SurfaceCard>
        </>
      )}

      <BottomSheet
        visible={isExportSheetOpen}
        onClose={() => {
          setIsExportSheetOpen(false)
          setExportPicker(null)
        }}
        title="Export Lead Data"
        testID="settings-export-sheet"
      >
        {exportNotice ? (
          <InlineMessage
            tone={exportNotice.tone}
            title={exportNotice.title}
            message={exportNotice.message}
          />
        ) : null}

        <View style={styles.pickerGroup}>
          <Text style={styles.fieldLabel}>From date</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open export from date picker"
            onPress={() => setExportPicker((current) => (current === "from" ? null : "from"))}
            style={({ pressed }) => [styles.pickerField, pressed ? styles.pressed : null]}
            testID="settings-export-open-from-date-picker"
          >
            <Text style={styles.pickerValue}>{formatDateLabel(exportFromDate)}</Text>
            <Feather name="calendar" size={18} color={mobileTheme.colors.mutedInk} />
          </Pressable>
          {exportPicker === "from" ? (
            <View style={styles.nativePickerShell}>
              <DateTimePicker
                testID="settings-export-native-from-date-picker"
                mode="date"
                value={exportFromDate}
                onChange={handleExportDateChange("from")}
              />
              {Platform.OS === "ios" ? (
                <ActionButton
                  label="Done with from date"
                  tone="secondary"
                  onPress={() => setExportPicker(null)}
                  testID="settings-export-close-from-date-picker"
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.pickerGroup}>
          <Text style={styles.fieldLabel}>To date</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open export to date picker"
            onPress={() => setExportPicker((current) => (current === "to" ? null : "to"))}
            style={({ pressed }) => [styles.pickerField, pressed ? styles.pressed : null]}
            testID="settings-export-open-to-date-picker"
          >
            <Text style={styles.pickerValue}>{formatDateLabel(exportToDate)}</Text>
            <Feather name="calendar" size={18} color={mobileTheme.colors.mutedInk} />
          </Pressable>
          {exportPicker === "to" ? (
            <View style={styles.nativePickerShell}>
              <DateTimePicker
                testID="settings-export-native-to-date-picker"
                mode="date"
                value={exportToDate}
                onChange={handleExportDateChange("to")}
              />
              {Platform.OS === "ios" ? (
                <ActionButton
                  label="Done with to date"
                  tone="secondary"
                  onPress={() => setExportPicker(null)}
                  testID="settings-export-close-to-date-picker"
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <ActionButton
          label={isExporting ? "Exporting CSV..." : "Export CSV"}
          icon="download"
          onPress={() => {
            void exportLeadData()
          }}
          disabled={isExporting}
          testID="settings-export-submit-button"
        />
      </BottomSheet>

      <BottomSheet
        visible={isDeletionSheetOpen}
        onClose={() => {
          setIsDeletionSheetOpen(false)
        }}
        title="Account Deletion"
        testID="settings-account-deletion-sheet"
      >
        {deletionNotice ? (
          <InlineMessage
            tone={deletionNotice.tone}
            title={deletionNotice.title}
            message={deletionNotice.message}
          />
        ) : null}

        <Text style={styles.deletionCopy}>
          This starts deletion for your ShowReady account and associated workspace data, including
          lead and client records. Some security, legal, support, and audit records may be retained
          where required.
        </Text>
        <Text style={styles.deletionCopy}>
          Export lead data first if you need a copy before submitting this request.
        </Text>
        <FormField
          label="Request note"
          value={deletionNote}
          onChangeText={setDeletionNote}
          placeholder="Optional context for support"
          multiline
          testID="settings-account-deletion-note-input"
        />
        <ActionButton
          label={isRequestingDeletion ? "Sending request..." : "Submit deletion request"}
          icon="trash-2"
          tone="danger"
          onPress={() => {
            void requestAccountDeletion()
          }}
          disabled={isRequestingDeletion}
          testID="settings-submit-account-deletion-button"
        />
        <ActionButton
          label="Keep account"
          tone="secondary"
          onPress={() => {
            setIsDeletionSheetOpen(false)
          }}
          testID="settings-cancel-account-deletion-button"
        />
      </BottomSheet>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  identityCard: {
    gap: 10
  },
  identityEmail: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  formCard: {
    gap: 16
  },
  exportCard: {
    gap: 12
  },
  exportHeaderRow: {
    gap: 14
  },
  exportTitleGroup: {
    gap: 4
  },
  exportMeta: {
    fontSize: mobileTheme.typography.bodySmall,
    lineHeight: 20,
    color: mobileTheme.colors.mutedInk
  },
  feedbackCard: {
    gap: 16
  },
  legalCard: {
    gap: 16
  },
  legalBody: {
    fontSize: mobileTheme.typography.bodySmall,
    lineHeight: 20,
    color: mobileTheme.colors.mutedInk
  },
  legalLinkGrid: {
    gap: 10
  },
  deletionCopy: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 22,
    color: mobileTheme.colors.mutedInk
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  preferenceCopy: {
    flex: 1,
    gap: 4
  },
  preferenceTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  pickerGroup: {
    gap: 8
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
    color: mobileTheme.colors.brandStrong
  },
  pickerField: {
    minHeight: 52,
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    backgroundColor: mobileTheme.colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  pickerValue: {
    flex: 1,
    fontSize: mobileTheme.typography.body,
    color: mobileTheme.colors.ink,
    fontWeight: "700"
  },
  nativePickerShell: {
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    padding: 8,
    gap: 8
  },
  pressed: {
    opacity: 0.88
  }
})
