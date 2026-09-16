import DateTimePicker from "@react-native-community/datetimepicker"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { Feather } from "@expo/vector-icons"
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native"
import type { Appointment, Lead } from "@showready/contracts"
import { EmptyState } from "@/components/empty-state"
import { ScreenShell } from "@/components/screen-shell"
import { ActionButton } from "@/components/ui/action-button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FormField } from "@/components/ui/form-field"
import { InlineMessage } from "@/components/ui/inline-message"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { SurfaceCard } from "@/components/ui/surface-card"
import { StageChip } from "@/components/ui/stage-chip"
import { captureDiagnosticsError } from "@/lib/diagnostics/service"
import { settingsHeaderAction } from "@/lib/settings-header-action"
import { mobileTheme } from "@/lib/theme"
import { useMobileApi, useSession } from "@/providers/session-provider"

type AppointmentStatusFilter = "scheduled" | "completed" | "cancelled"
type AppointmentPicker = "date" | "time" | null

function padNumber(value: number) {
  return String(value).padStart(2, "0")
}

function formatApiDate(value: Date) {
  return `${value.getFullYear()}-${padNumber(value.getMonth() + 1)}-${padNumber(value.getDate())}`
}

function formatApiTime(value: Date) {
  return `${padNumber(value.getHours())}:${padNumber(value.getMinutes())}`
}

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "Choose a date"
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value)
}

function formatTimeLabel(value: Date | null) {
  if (!value) {
    return "Choose a time"
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(value)
}

function matchesLeadSearch(lead: Lead, query: string) {
  if (!query) {
    return true
  }

  return [lead.buyerName, lead.buyerEmail, lead.buyerPhone]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query)
}

function reportAppointmentsError(error: unknown, context: Record<string, string>) {
  void captureDiagnosticsError(error, {
    eventType: "error.handled",
    category: "api",
    severity: "error",
    screen: "appointments",
    context
  }).catch(() => {})
}

export default function AppointmentsScreen() {
  const { session, workspaceVersion = 0 } = useSession()
  const api = useMobileApi()
  const [status, setStatus] = useState<AppointmentStatusFilter>("scheduled")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [appointmentNextOffset, setAppointmentNextOffset] = useState<number | undefined>()
  const [isLoadingMoreAppointments, setIsLoadingMoreAppointments] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadSearchQuery, setLeadSearchQuery] = useState("")
  const deferredLeadSearchQuery = useDeferredValue(leadSearchQuery.trim().toLowerCase())
  const [selectedLeadId, setSelectedLeadId] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<Date | null>(null)
  const [showingAddress, setShowingAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [activePicker, setActivePicker] = useState<AppointmentPicker>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [message, setMessage] = useState<{
    tone: "success" | "warning" | "error"
    title: string
    message: string
  } | null>(null)
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isScheduleSheetOpen, setIsScheduleSheetOpen] = useState(false)

  const eligibleLeads = useMemo(
    () => leads.filter((lead) => ["ready_to_show", "nurture", "hold"].includes(lead.pipelineStage)),
    [leads]
  )
  const leadSearchIsActive = leadSearchQuery.trim().length > 0
  const filteredEligibleLeads = useMemo(
    () =>
      eligibleLeads
        .filter((lead) => matchesLeadSearch(lead, deferredLeadSearchQuery))
        .slice(0, 10),
    [deferredLeadSearchQuery, eligibleLeads]
  )
  const suggestedReadyLeads = useMemo(
    () =>
      eligibleLeads
        .filter((lead) => lead.pipelineStage === "ready_to_show")
        .slice(0, 3),
    [eligibleLeads]
  )
  const visibleLeadOptions = leadSearchIsActive ? filteredEligibleLeads : suggestedReadyLeads
  const leadSearchAccessoryID =
    Platform.OS === "ios" ? "appointment-lead-search-input-keyboard-accessory" : undefined

  async function loadData(nextStatus = status) {
    if (!session) {
      return
    }

    try {
      const data = await api.getAppointmentsInitialData({
        status: nextStatus,
        limit: 25,
        offset: 0,
        leadLimit: 3
      })
      setAppointments(data.appointments.appointments)
      setAppointmentNextOffset(data.appointments.nextOffset)
      setLeads(data.eligibleLeads)
      setLoadState("ready")
    } catch (error) {
      reportAppointmentsError(error, {
        action: "load-appointments",
        status: nextStatus
      })
      setMessage({
        tone: "error",
        title: "Unable to load appointments",
        message: "Try again once the workspace reconnects."
      })
      setLoadState("error")
    }
  }

  useEffect(() => {
    void loadData(status)
  }, [session, status, workspaceVersion])

  useEffect(() => {
    if (!isScheduleSheetOpen) {
      return
    }

    let isMounted = true
    const query = deferredLeadSearchQuery

    api
      .listLeads({
        scope: "appointment_eligible",
        query: query || undefined,
        limit: query ? 10 : 3,
        offset: 0
      })
      .then((page) => {
        if (isMounted) {
          setLeads(page.leads)
        }
      })
      .catch((error) => {
        if (isMounted) {
          reportAppointmentsError(error, {
            action: "search-appointment-leads",
            query: query ? "present" : "empty"
          })
          setMessage({
            tone: "error",
            title: "Unable to search leads",
            message: "Try again once the workspace reconnects."
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [api, deferredLeadSearchQuery, isScheduleSheetOpen])

  async function handleLoadMoreAppointments() {
    if (appointmentNextOffset === undefined || isLoadingMoreAppointments) {
      return
    }

    setIsLoadingMoreAppointments(true)

    try {
      const page = await api.listAppointments({
        status,
        limit: 25,
        offset: appointmentNextOffset
      })
      setAppointments((current) => current.concat(page.appointments))
      setAppointmentNextOffset(page.nextOffset)
    } catch (error) {
      reportAppointmentsError(error, {
        action: "load-more-appointments",
        status
      })
      setMessage({
        tone: "error",
        title: "Unable to load more appointments",
        message: "Try again once the workspace reconnects."
      })
    } finally {
      setIsLoadingMoreAppointments(false)
    }
  }

  async function handleSave() {
    if (!selectedLeadId || !selectedDate || !selectedTime || !showingAddress.trim()) {
      setMessage({
        tone: "warning",
        title: "Missing appointment details",
        message: "Pick a lead and add the date, time, and first showing address."
      })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      await api.saveAppointment({
        leadId: selectedLeadId,
        date: formatApiDate(selectedDate),
        startTime: formatApiTime(selectedTime),
        notes: notes.trim(),
        showings: [{ address: showingAddress.trim() }]
      })
      setLeadSearchQuery("")
      setSelectedLeadId("")
      setSelectedDate(null)
      setSelectedTime(null)
      setShowingAddress("")
      setNotes("")
      setActivePicker(null)
      setIsScheduleSheetOpen(false)
      setMessage({
        tone: "success",
        title: "Appointment saved",
        message: "The schedule is now live in the agent queue."
      })
      await loadData("scheduled")
      setStatus("scheduled")
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to save appointment",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(
    appointmentId: string,
    nextStatus: "completed" | "cancelled"
  ) {
    setBusyAppointmentId(appointmentId)
    setMessage(null)

    try {
      await api.updateAppointmentStatus(appointmentId, nextStatus)
      setMessage({
        tone: "success",
        title: "Appointment updated",
        message: `Marked this appointment as ${nextStatus}.`
      })
      setStatus(nextStatus)
      await loadData(nextStatus)
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to update appointment",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setBusyAppointmentId(null)
    }
  }

  function handlePickerChange(nextPicker: Exclude<AppointmentPicker, null>) {
    return (_event: { type?: string }, nextValue?: Date) => {
      if (_event?.type === "dismissed" || !nextValue) {
        if (Platform.OS !== "ios") {
          setActivePicker(null)
        }
        return
      }

      if (nextPicker === "date") {
        setSelectedDate(nextValue)
      } else {
        setSelectedTime(nextValue)
      }

      if (Platform.OS !== "ios") {
        setActivePicker(null)
      }
    }
  }

  function togglePicker(nextPicker: Exclude<AppointmentPicker, null>) {
    const now = new Date()

    if (nextPicker === "date") {
      setSelectedDate((current) => current ?? now)
    } else {
      setSelectedTime((current) => current ?? now)
    }

    setActivePicker((current) => (current === nextPicker ? null : nextPicker))
  }

  function openScheduleSheet() {
    setMessage(null)
    setIsScheduleSheetOpen(true)
  }

  function renderSaveAppointmentButton() {
    return (
      <ActionButton
        label={isSaving ? "Saving appointment..." : "Save appointment"}
        icon="calendar"
        onPress={() => {
          void handleSave()
        }}
        disabled={isSaving || eligibleLeads.length === 0}
        testID="appointment-save-button"
      />
    )
  }

  function selectLead(leadId: string) {
    const now = new Date()

    Keyboard.dismiss()
    setSelectedLeadId(leadId)
    setSelectedDate((current) => current ?? now)
    setSelectedTime((current) => current ?? now)
  }

  return (
    <ScreenShell
      title="Appointments"
      subtitle="Manage your showings and history."
      testID="appointments-screen"
      headerAction={settingsHeaderAction("appointments-settings-button")}
    >
      <SurfaceCard style={styles.schedulePromptCard}>
        <ActionButton
          label="Schedule showing"
          icon="calendar"
          onPress={openScheduleSheet}
          testID="appointments-open-schedule-sheet"
        />
      </SurfaceCard>

      {message ? (
        <InlineMessage tone={message.tone} title={message.title} message={message.message} />
      ) : null}

      <SegmentedControl
        value={status}
        onChange={setStatus}
        options={[
          { label: "Upcoming", value: "scheduled" },
          { label: "Completed", value: "completed" },
          { label: "Cancelled", value: "cancelled" }
        ]}
        variant="tabs"
        testIDPrefix="appointments-tab"
      />

      {loadState === "loading" ? (
        <EmptyState title="Loading appointments" body="Pulling the current appointment queue." />
      ) : loadState === "error" ? (
        <EmptyState title="Appointments unavailable" body="Try again once the workspace reconnects." />
      ) : appointments.length === 0 ? (
        <EmptyState
          title="No appointments in this tab"
          body="Schedule a showing or switch tabs to review completed and cancelled history."
          actionLabel="Schedule now"
          actionIcon="calendar"
          actionTone="secondary"
          onAction={openScheduleSheet}
          variant="guided"
          eyebrow="Start here"
          icon="calendar"
        />
      ) : (
        <>
          {appointments.map((appointment) => (
            <SurfaceCard key={appointment.id} style={styles.card} testID={`appointment-card-${appointment.id}`}>
              <View style={styles.appointmentHeader}>
                <View style={styles.headerMeta}>
                  <Text style={styles.name}>{appointment.lead.buyerName}</Text>
                  <Text style={styles.meta}>
                    {appointment.date} at {appointment.startTime}
                  </Text>
                </View>
                <StageChip stage={appointment.lead.pipelineStage} />
              </View>

              {appointment.notes ? <Text style={styles.meta}>{appointment.notes}</Text> : null}

              <View style={styles.showings}>
                {appointment.showings.map((showing, index) => (
                  <View key={showing.id} style={styles.showingRow}>
                    <Text style={styles.showingIndex}>Stop {index + 1}</Text>
                    <Text style={styles.showingAddress}>{showing.address}</Text>
                    {showing.notes ? <Text style={styles.meta}>{showing.notes}</Text> : null}
                  </View>
                ))}
              </View>

              {status === "scheduled" ? (
                <View style={styles.actionRow}>
                  <ActionButton
                    label="Mark complete"
                    icon="check"
                    onPress={() => {
                      void handleStatusChange(appointment.id, "completed")
                    }}
                    disabled={busyAppointmentId === appointment.id}
                    testID={`appointment-complete-lead-${appointment.lead.id}`}
                  />
                  <ActionButton
                    label="Cancel"
                    icon="x"
                    tone="danger"
                    onPress={() => {
                      void handleStatusChange(appointment.id, "cancelled")
                    }}
                    disabled={busyAppointmentId === appointment.id}
                    testID={`appointment-cancel-lead-${appointment.lead.id}`}
                  />
                </View>
              ) : null}
            </SurfaceCard>
          ))}
          {appointmentNextOffset !== undefined ? (
            <ActionButton
              label={isLoadingMoreAppointments ? "Loading..." : "Load more"}
              tone="secondary"
              onPress={() => {
                void handleLoadMoreAppointments()
              }}
              disabled={isLoadingMoreAppointments}
              testID="appointments-load-more"
            />
          ) : null}
        </>
      )}
      <BottomSheet
        visible={isScheduleSheetOpen}
        onClose={() => setIsScheduleSheetOpen(false)}
        title="Create appointment"
        testID="appointments-schedule-sheet"
      >
        {message ? (
          <View testID="appointments-schedule-sheet-message">
            <InlineMessage tone={message.tone} title={message.title} message={message.message} />
          </View>
        ) : null}

        <View style={styles.searchGroup}>
          <Text style={styles.fieldLabel}>Search leads</Text>
          <View style={styles.searchInputShell}>
            <Feather name="search" size={16} color={mobileTheme.colors.mutedInk} />
            <TextInput
              testID="appointment-lead-search-input"
              value={leadSearchQuery}
              onChangeText={setLeadSearchQuery}
              placeholder="Search by name, email, or phone"
              placeholderTextColor={mobileTheme.colors.mutedInk}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              inputAccessoryViewID={leadSearchAccessoryID}
              style={styles.searchInput}
            />
          </View>
          {leadSearchAccessoryID ? (
            <InputAccessoryView nativeID={leadSearchAccessoryID}>
              <View style={styles.keyboardAccessory}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done searching leads"
                  onPress={Keyboard.dismiss}
                  style={({ pressed }) => [
                    styles.keyboardAccessoryButton,
                    pressed ? styles.keyboardAccessoryButtonPressed : null
                  ]}
                  testID="appointment-lead-search-input-keyboard-done"
                >
                  <Text style={styles.keyboardAccessoryButtonText}>Done</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}
        </View>

        {eligibleLeads.length === 0 ? (
          <InlineMessage
            tone="warning"
            title="No eligible leads"
            message="Move a lead into Ready, Nurture, or Hold before scheduling from mobile."
          />
        ) : visibleLeadOptions.length === 0 ? (
          leadSearchIsActive ? (
            <EmptyState
              title="No leads match this search"
              body="Try a different name, email, phone number, or clear the search."
              actionLabel="Clear search"
              actionTestID="appointment-clear-lead-search"
              onAction={() => setLeadSearchQuery("")}
              variant="guided"
              eyebrow="Search"
              icon="search"
            />
          ) : (
            <InlineMessage
              tone="warning"
              title="No ready leads to suggest"
              message="Search by name, email, or phone to schedule another eligible lead."
            />
          )
        ) : (
          <View style={styles.leadPicker}>
            {visibleLeadOptions.map((lead) => {
              const isSelected = selectedLeadId === lead.id

              return (
                <Pressable
                  key={lead.id}
                  testID={`appointment-lead-option-${lead.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => selectLead(lead.id)}
                  style={[styles.leadOption, isSelected ? styles.leadOptionSelected : null]}
                >
                  <View style={styles.leadOptionCopy}>
                    <Text
                      style={[
                        styles.leadOptionLabel,
                        isSelected ? styles.leadOptionLabelSelected : null
                      ]}
                    >
                      {lead.buyerName}
                    </Text>
                    <Text style={styles.leadOptionMeta}>
                      {lead.buyerEmail ?? lead.buyerPhone ?? "Awaiting contact details"}
                    </Text>
                  </View>
                  <StageChip stage={lead.pipelineStage} recommendation={lead.recommendation} />
                </Pressable>
              )
            })}
          </View>
        )}

        <View style={styles.pickerGroup}>
          <Text style={styles.fieldLabel}>Date</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open appointment date picker"
            onPress={() => togglePicker("date")}
            style={({ pressed }) => [styles.pickerField, pressed ? styles.pressed : null]}
            testID="appointment-open-date-picker"
          >
            <View style={styles.pickerFieldCopy}>
              <Text style={styles.pickerValue}>{formatDateLabel(selectedDate)}</Text>
            </View>
            <Feather name="calendar" size={18} color={mobileTheme.colors.mutedInk} />
          </Pressable>
          {activePicker === "date" ? (
            <View style={styles.nativePickerShell}>
              <DateTimePicker
                testID="appointment-native-date-picker"
                mode="date"
                value={selectedDate ?? new Date()}
                onChange={handlePickerChange("date")}
              />
              {Platform.OS === "ios" ? (
                <ActionButton
                  label="Done with date"
                  tone="secondary"
                  onPress={() => setActivePicker(null)}
                  testID="appointment-close-date-picker"
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.pickerGroup}>
          <Text style={styles.fieldLabel}>Start time</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open appointment time picker"
            onPress={() => togglePicker("time")}
            style={({ pressed }) => [styles.pickerField, pressed ? styles.pressed : null]}
            testID="appointment-open-time-picker"
          >
            <View style={styles.pickerFieldCopy}>
              <Text style={styles.pickerValue}>{formatTimeLabel(selectedTime)}</Text>
            </View>
            <Feather name="clock" size={18} color={mobileTheme.colors.mutedInk} />
          </Pressable>
          {activePicker === "time" ? (
            <View style={styles.nativePickerShell}>
              <DateTimePicker
                testID="appointment-native-time-picker"
                mode="time"
                value={selectedTime ?? new Date()}
                onChange={handlePickerChange("time")}
              />
              {Platform.OS === "ios" ? (
                <ActionButton
                  label="Done with time"
                  tone="secondary"
                  onPress={() => setActivePicker(null)}
                  testID="appointment-close-time-picker"
                />
              ) : null}
            </View>
          ) : null}
        </View>
        <FormField
          label="First showing address"
          value={showingAddress}
          onChangeText={setShowingAddress}
          placeholder="123 Queen St W, Toronto"
          autoComplete="street-address"
          testID="appointment-address-input"
        />
        {Platform.OS === "android" ? renderSaveAppointmentButton() : null}
        <FormField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional access notes"
          multiline
          multilineMinHeight={Platform.OS === "android" ? 72 : undefined}
          testID="appointment-notes-input"
        />
        {Platform.OS !== "android" ? renderSaveAppointmentButton() : null}
      </BottomSheet>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  schedulePromptCard: {
    gap: 12
  },
  formCard: {
    gap: 16
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
  searchGroup: {
    gap: 8
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
    color: mobileTheme.colors.brandStrong
  },
  searchInputShell: {
    minHeight: 52,
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    backgroundColor: mobileTheme.colors.surface,
    paddingLeft: 14,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    color: mobileTheme.colors.ink,
    fontSize: mobileTheme.typography.body
  },
  keyboardAccessory: {
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  keyboardAccessoryButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: mobileTheme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileTheme.colors.surfaceMuted
  },
  keyboardAccessoryButtonPressed: {
    opacity: 0.86
  },
  keyboardAccessoryButtonText: {
    color: mobileTheme.colors.brandStrong,
    fontSize: mobileTheme.typography.bodySmall,
    fontWeight: "800"
  },
  leadPicker: {
    gap: 10
  },
  leadOption: {
    minHeight: 64,
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  leadOptionSelected: {
    borderColor: mobileTheme.colors.brand,
    backgroundColor: mobileTheme.colors.surfaceTint
  },
  leadOptionCopy: {
    flex: 1,
    gap: 4
  },
  leadOptionLabel: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 20,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  leadOptionLabelSelected: {
    color: mobileTheme.colors.brandStrong
  },
  leadOptionMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: mobileTheme.colors.mutedInk
  },
  pickerGroup: {
    gap: 8
  },
  pickerField: {
    minHeight: 58,
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  pickerFieldCopy: {
    flex: 1,
    gap: 4
  },
  pickerValue: {
    fontSize: mobileTheme.typography.body,
    fontWeight: "700",
    color: mobileTheme.colors.ink
  },
  nativePickerShell: {
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    padding: 12,
    gap: 10
  },
  card: {
    gap: 16
  },
  appointmentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  headerMeta: {
    flex: 1,
    gap: 4
  },
  name: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  meta: {
    fontSize: 13,
    lineHeight: 19,
    color: mobileTheme.colors.mutedInk
  },
  showings: {
    gap: 10
  },
  showingRow: {
    borderRadius: mobileTheme.radii.control,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    padding: 14,
    gap: 4
  },
  showingIndex: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
    color: mobileTheme.colors.brandStrong
  },
  showingAddress: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 22,
    color: mobileTheme.colors.ink
  },
  actionRow: {
    gap: 10
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }]
  }
})
