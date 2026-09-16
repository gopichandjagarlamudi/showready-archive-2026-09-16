import DateTimePicker from "@react-native-community/datetimepicker"
import { Feather } from "@expo/vector-icons"
import { memo, useDeferredValue, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native"
import { router } from "expo-router"
import type {
  LeadStage,
  PipelineCategory,
  PipelineLead,
  PipelineTab
} from "@showready/contracts"
import { EmptyState } from "@/components/empty-state"
import { ScreenShell } from "@/components/screen-shell"
import { ActionButton } from "@/components/ui/action-button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { InlineMessage } from "@/components/ui/inline-message"
import { LeadIntentChip } from "@/components/ui/lead-intent-chip"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { StageChip } from "@/components/ui/stage-chip"
import { SurfaceCard } from "@/components/ui/surface-card"
import { settingsHeaderAction } from "@/lib/settings-header-action"
import { mobileTheme } from "@/lib/theme"
import { useMobileApi, useSession } from "@/providers/session-provider"

const PAGE_SIZE = 25
const ACTIVE_CATEGORY_OPTIONS: Array<{ value: PipelineCategory; label: string }> = [
  { value: "all", label: "All active" },
  { value: "ready_to_show", label: "Ready to Show" },
  { value: "nurture", label: "Nurture" },
  { value: "hold", label: "Hold" },
  { value: "buy", label: "Buy" },
  { value: "rent", label: "Rent" }
]
const RESOLVED_CATEGORY_OPTIONS: Array<{ value: PipelineCategory; label: string }> = [
  { value: "all", label: "All resolved" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
  { value: "archived", label: "Archived" },
  { value: "buy", label: "Buy" },
  { value: "rent", label: "Rent" }
]
const MOVE_STAGES: Array<
  Extract<
    LeadStage,
    "ready_to_show" | "nurture" | "hold" | "closed_won" | "closed_lost" | "archived"
  >
> = ["ready_to_show", "nurture", "hold", "closed_won", "closed_lost", "archived"]

type SubmittedDatePreset = "none" | "today" | "yesterday" | "last_7_days" | "pick_date"
type LoadState = "loading" | "ready" | "error"

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addLocalDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function getSubmittedDateRange(preset: SubmittedDatePreset, selectedDate: Date | null) {
  const today = startOfLocalDay(new Date())

  if (preset === "today") {
    return {
      submittedFrom: today.toISOString(),
      submittedTo: addLocalDays(today, 1).toISOString()
    }
  }

  if (preset === "yesterday") {
    const yesterday = addLocalDays(today, -1)
    return {
      submittedFrom: yesterday.toISOString(),
      submittedTo: today.toISOString()
    }
  }

  if (preset === "last_7_days") {
    return {
      submittedFrom: addLocalDays(today, -6).toISOString(),
      submittedTo: addLocalDays(today, 1).toISOString()
    }
  }

  if (preset === "pick_date" && selectedDate) {
    const selectedDay = startOfLocalDay(selectedDate)
    return {
      submittedFrom: selectedDay.toISOString(),
      submittedTo: addLocalDays(selectedDay, 1).toISOString()
    }
  }

  return {}
}

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "Pick date"
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value)
}

function labelForDatePreset(preset: SubmittedDatePreset, selectedDate: Date | null) {
  if (preset === "today") {
    return "Submitted today"
  }

  if (preset === "yesterday") {
    return "Submitted yesterday"
  }

  if (preset === "last_7_days") {
    return "Submitted last 7 days"
  }

  if (preset === "pick_date") {
    return `Submitted ${formatDateLabel(selectedDate)}`
  }

  return "Any submitted date"
}

function getCategoryOptions(tab: PipelineTab) {
  return tab === "active" ? ACTIVE_CATEGORY_OPTIONS : RESOLVED_CATEGORY_OPTIONS
}

function getCategoryLabel(tab: PipelineTab, category: PipelineCategory) {
  return (
    getCategoryOptions(tab).find((option) => option.value === category)?.label ??
    (tab === "active" ? "All active" : "All resolved")
  )
}

function stageLabel(stage: string) {
  return stage.replaceAll("_", " ")
}

function getEmptyState(
  loadState: LoadState,
  mode: "focus_queue" | "filtered_results",
  hasSearchOrFilters: boolean
) {
  if (loadState === "loading") {
    return {
      title: "Loading pipeline",
      body: "Pulling a focused lead list from the workspace."
    }
  }

  if (loadState === "error") {
    return {
      title: "Pipeline unavailable",
      body: "Refresh after the network settles or after signing back in."
    }
  }

  if (mode === "focus_queue" && !hasSearchOrFilters) {
    return {
      title: "Focus queue is clear",
      body: "No reviewed active leads need attention right now. Search or filter to browse the wider pipeline."
    }
  }

  return {
    title: "No leads match these filters",
    body: "Try a broader search, clear the submitted date, or switch stages."
  }
}

const PipelineLeadCard = memo(function PipelineLeadCard({
  lead,
  onOpen,
  onMove
}: {
  lead: PipelineLead
  onOpen: (leadId: string) => void
  onMove: (lead: PipelineLead) => void
}) {
  return (
    <SurfaceCard style={styles.card} testID={`pipeline-card-${lead.id}`}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{lead.buyerName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.name}>{lead.buyerName}</Text>
            <Text style={styles.contact}>
              {lead.buyerEmail ?? lead.buyerPhone ?? "Awaiting contact details"}
            </Text>
          </View>
        </View>
        <View style={styles.headerChips}>
          <LeadIntentChip
            intakeType={lead.intakeType}
            testID={`pipeline-intent-chip-${lead.id}`}
          />
          <StageChip stage={lead.pipelineStage} recommendation={lead.recommendation} />
        </View>
      </View>
      {lead.attentionReason ? (
        <View style={styles.attentionRow}>
          <Feather name="zap" size={14} color={mobileTheme.colors.brandStrong} />
          <Text style={styles.attentionText}>{lead.attentionReason}</Text>
        </View>
      ) : null}
      <Text style={styles.summary}>{lead.summary ?? "Scoring summary pending."}</Text>
      <View style={styles.primaryActions}>
        <ActionButton
          label="Open full detail"
          icon="chevron-right"
          onPress={() => onOpen(lead.id)}
          testID={`pipeline-open-${lead.id}`}
        />
        <ActionButton
          label="Update stage"
          tone="secondary"
          icon="sliders"
          onPress={() => onMove(lead)}
          testID={`pipeline-open-stage-sheet-${lead.id}`}
        />
      </View>
    </SurfaceCard>
  )
})

export default function PipelineScreen() {
  const { session, workspaceVersion = 0 } = useSession()
  const api = useMobileApi()
  const [leads, setLeads] = useState<PipelineLead[]>([])
  const [tab, setTab] = useState<PipelineTab>("active")
  const [category, setCategory] = useState<PipelineCategory>("all")
  const [draftCategory, setDraftCategory] = useState<PipelineCategory>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery.trim())
  const [submittedDatePreset, setSubmittedDatePreset] = useState<SubmittedDatePreset>("none")
  const [submittedDate, setSubmittedDate] = useState<Date | null>(null)
  const [draftDatePreset, setDraftDatePreset] = useState<SubmittedDatePreset>("none")
  const [draftSubmittedDate, setDraftSubmittedDate] = useState<Date | null>(null)
  const [showDraftDatePicker, setShowDraftDatePicker] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [summaryLabel, setSummaryLabel] = useState("Loading pipeline")
  const [mode, setMode] = useState<"focus_queue" | "filtered_results">("focus_queue")
  const [nextOffset, setNextOffset] = useState<number | undefined>()
  const [total, setTotal] = useState(0)
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null)
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const submittedDateTime = submittedDate?.getTime() ?? 0

  useEffect(() => {
    setCategory("all")
    setDraftCategory("all")
  }, [tab])

  useEffect(() => {
    let isMounted = true

    async function load() {
      if (!session) {
        return
      }

      const dateRange = getSubmittedDateRange(submittedDatePreset, submittedDate)
      setLoadState("loading")
      setLoadError(null)

      try {
        const result = await api.listPipelineLeads({
          tab,
          category,
          query: deferredSearchQuery || undefined,
          ...dateRange,
          limit: PAGE_SIZE,
          offset: 0
        })

        if (!isMounted) {
          return
        }

        setLeads(result.leads)
        setSummaryLabel(result.summaryLabel)
        setMode(result.mode)
        setNextOffset(result.nextOffset)
        setTotal(result.total)
        setLoadState("ready")
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(error instanceof Error ? error.message : "Unable to load pipeline.")
        setLoadState("error")
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [
    api,
    category,
    deferredSearchQuery,
    session,
    submittedDatePreset,
    submittedDateTime,
    tab,
    refreshKey,
    workspaceVersion
  ])

  async function loadMore() {
    if (!nextOffset || isLoadingMore) {
      return
    }

    const dateRange = getSubmittedDateRange(submittedDatePreset, submittedDate)
    setIsLoadingMore(true)

    try {
      const result = await api.listPipelineLeads({
        tab,
        category,
        query: deferredSearchQuery || undefined,
        ...dateRange,
        limit: PAGE_SIZE,
        offset: nextOffset
      })

      setLeads((current) => [...current, ...result.leads])
      setSummaryLabel(result.summaryLabel)
      setMode(result.mode)
      setNextOffset(result.nextOffset)
      setTotal(result.total)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load more leads.")
    } finally {
      setIsLoadingMore(false)
    }
  }

  async function moveLead(
    leadId: string,
    stage: Extract<
      LeadStage,
      "ready_to_show" | "nurture" | "hold" | "closed_won" | "closed_lost" | "archived"
    >
  ) {
    setBusyLeadId(leadId)
    setMessage(null)

    try {
      const result = await api.moveLead(leadId, stage)
      setRefreshKey((current) => current + 1)
      setMessage(`Moved ${result.lead.buyerName} to ${stageLabel(stage)}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to move lead.")
    } finally {
      setBusyLeadId(null)
      setSelectedLead(null)
    }
  }

  function openFilterSheet() {
    setDraftCategory(category)
    setDraftDatePreset(submittedDatePreset)
    setDraftSubmittedDate(submittedDate)
    setShowDraftDatePicker(false)
    setIsFilterSheetOpen(true)
  }

  function applyFilters() {
    setCategory(draftCategory)
    setSubmittedDatePreset(draftDatePreset)
    setSubmittedDate(draftDatePreset === "pick_date" ? draftSubmittedDate : null)
    setIsFilterSheetOpen(false)
    setShowDraftDatePicker(false)
  }

  function clearFilters() {
    setDraftCategory("all")
    setDraftDatePreset("none")
    setDraftSubmittedDate(null)
    setShowDraftDatePicker(false)
  }

  function handleDatePresetPress(preset: SubmittedDatePreset) {
    setDraftDatePreset(preset)

    if (preset === "pick_date") {
      setShowDraftDatePicker(true)
    } else {
      setDraftSubmittedDate(null)
      setShowDraftDatePicker(false)
    }
  }

  const hasSearchOrFilters =
    Boolean(deferredSearchQuery) || category !== "all" || submittedDatePreset !== "none"
  const filterSummary = useMemo(() => {
    const parts = [getCategoryLabel(tab, category)]

    if (submittedDatePreset !== "none") {
      parts.push(labelForDatePreset(submittedDatePreset, submittedDate))
    }

    return parts.join(" · ")
  }, [category, submittedDate, submittedDatePreset, tab])
  const emptyState = getEmptyState(loadState, mode, hasSearchOrFilters)
  const categoryOptions = getCategoryOptions(tab)

  return (
    <ScreenShell
      title="Pipeline"
      scrollable={false}
      contentStyle={styles.screenContent}
      testID="pipeline-screen"
      headerAction={settingsHeaderAction("pipeline-settings-button")}
    >
      <FlatList
        data={leads}
        keyExtractor={(lead) => lead.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SegmentedControl
              value={tab}
              onChange={(value) => setTab(value as PipelineTab)}
              options={[
                { label: "Active", value: "active" },
                { label: "Resolved", value: "resolved" }
              ]}
              testIDPrefix="pipeline-tab"
            />

            <SurfaceCard style={styles.filtersCard}>
              <View style={styles.filtersHeader}>
                <View style={styles.filterHeaderCopy}>
                  <Text style={styles.fieldLabel}>Visible leads</Text>
                  <Text style={styles.summaryLabel}>{summaryLabel}</Text>
                </View>
                <View style={styles.resultsPill}>
                  <Text style={styles.resultsPillValue}>{leads.length}</Text>
                  <Text style={styles.resultsPillLabel}>shown</Text>
                </View>
              </View>

              <View style={styles.searchGroup}>
                <Text style={styles.fieldLabel}>Search leads</Text>
                <View style={styles.searchInputShell}>
                  <Feather name="search" size={16} color={mobileTheme.colors.mutedInk} />
                  <TextInput
                    testID="pipeline-search-input"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Name, email, phone, or notes"
                    placeholderTextColor={mobileTheme.colors.mutedInk}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    style={styles.searchInput}
                  />
                  {searchQuery.trim().length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear lead search"
                      onPress={() => setSearchQuery("")}
                      style={({ pressed }) => [styles.clearSearchButton, pressed ? styles.pressed : null]}
                      testID="pipeline-clear-search"
                    >
                      <Feather name="x" size={16} color={mobileTheme.colors.mutedInk} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open pipeline filters"
                accessibilityHint="Filter leads by category or submitted date."
                onPress={openFilterSheet}
                style={({ pressed }) => [styles.filterButton, pressed ? styles.pressed : null]}
                testID="pipeline-filter-button"
              >
                <View style={styles.filterButtonCopy}>
                  <Text style={styles.fieldLabel}>Filters</Text>
                  <Text style={styles.filterValue}>{filterSummary}</Text>
                </View>
                <Feather name="sliders" size={18} color={mobileTheme.colors.brandStrong} />
              </Pressable>
            </SurfaceCard>

            {mode === "focus_queue" && loadState === "ready" ? (
              <InlineMessage
                tone="warning"
                title="Focused queue"
                message="Showing reviewed active leads worth attention now. Search or filter to browse the wider pipeline."
              />
            ) : null}

            {message ? <InlineMessage tone="warning" title="Pipeline update" message={message} /> : null}
            {loadError ? <InlineMessage tone="error" title="Pipeline unavailable" message={loadError} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <PipelineLeadCard
            lead={item}
            onOpen={(leadId) => router.push(`/lead/${leadId}`)}
            onMove={setSelectedLead}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        ListEmptyComponent={
          <EmptyState
            title={emptyState.title}
            body={emptyState.body}
            variant={loadState === "loading" ? undefined : "guided"}
            eyebrow={loadState === "loading" ? undefined : "Pipeline"}
          />
        }
        ListFooterComponent={
          nextOffset ? (
            <View style={styles.footer}>
              <ActionButton
                label={isLoadingMore ? "Loading leads..." : "Load next 25"}
                tone="secondary"
                icon="chevron-down"
                onPress={() => {
                  void loadMore()
                }}
                disabled={isLoadingMore}
                testID="pipeline-load-more"
              />
              <Text style={styles.footerHint}>{total} total matches. Details load when a lead opens.</Text>
            </View>
          ) : loadState === "loading" ? (
            <View style={styles.footer}>
              <ActivityIndicator color={mobileTheme.colors.brandStrong} />
            </View>
          ) : null
        }
      />

      <BottomSheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter leads"
        subtitle="Narrow the pipeline without loading every lead."
        testID="pipeline-filter-sheet"
      >
        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Category</Text>
          <View style={styles.optionGrid}>
            {categoryOptions.map((option) => (
              <FilterChoice
                key={option.value}
                label={option.label}
                selected={draftCategory === option.value}
                onPress={() => setDraftCategory(option.value)}
                testID={`pipeline-stage-option-${option.value}`}
              />
            ))}
          </View>
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Submitted date</Text>
          <View style={styles.optionGrid}>
            <FilterChoice
              label="Any date"
              selected={draftDatePreset === "none"}
              onPress={() => handleDatePresetPress("none")}
              testID="pipeline-date-preset-none"
            />
            <FilterChoice
              label="Today"
              selected={draftDatePreset === "today"}
              onPress={() => handleDatePresetPress("today")}
              testID="pipeline-date-preset-today"
            />
            <FilterChoice
              label="Yesterday"
              selected={draftDatePreset === "yesterday"}
              onPress={() => handleDatePresetPress("yesterday")}
              testID="pipeline-date-preset-yesterday"
            />
            <FilterChoice
              label="Last 7 days"
              selected={draftDatePreset === "last_7_days"}
              onPress={() => handleDatePresetPress("last_7_days")}
              testID="pipeline-date-preset-last_7_days"
            />
            <FilterChoice
              label={formatDateLabel(draftSubmittedDate)}
              selected={draftDatePreset === "pick_date"}
              onPress={() => handleDatePresetPress("pick_date")}
              testID="pipeline-date-preset-pick_date"
            />
          </View>

          {showDraftDatePicker ? (
            <DateTimePicker
              testID="pipeline-native-date-picker"
              mode="date"
              value={draftSubmittedDate ?? new Date()}
              onChange={(event: { type?: string }, nextValue?: Date) => {
                if (event?.type === "dismissed" || !nextValue) {
                  return
                }

                setDraftSubmittedDate(nextValue)
                setDraftDatePreset("pick_date")
              }}
            />
          ) : null}
        </View>

        <View style={styles.sheetActions}>
          <ActionButton
            label="Clear filters"
            tone="secondary"
            icon="x"
            onPress={clearFilters}
            testID="pipeline-filter-clear"
          />
          <ActionButton
            label="Apply filters"
            icon="check"
            onPress={applyFilters}
            testID="pipeline-filter-apply"
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        title={selectedLead ? `Move ${selectedLead.buyerName}` : "Move lead"}
        testID="pipeline-stage-sheet"
      >
        {selectedLead ? (
          <>
            <InlineMessage
              tone="warning"
              title="Current stage"
              message={stageLabel(selectedLead.pipelineStage)}
            />
            <View style={styles.sheetActions}>
              {MOVE_STAGES.map((stage) => (
                <ActionButton
                  key={stage}
                  label={stageLabel(stage)}
                  tone={stage === selectedLead.pipelineStage ? "primary" : "secondary"}
                  onPress={() => {
                    void moveLead(selectedLead.id, stage)
                  }}
                  disabled={busyLeadId === selectedLead.id}
                  testID={`pipeline-move-${selectedLead.id}-${stage}`}
                />
              ))}
            </View>
          </>
        ) : null}
      </BottomSheet>
    </ScreenShell>
  )
}

function FilterChoice({
  label,
  selected,
  onPress,
  testID
}: {
  label: string
  selected: boolean
  onPress: () => void
  testID: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.filterChoice,
        selected ? styles.filterChoiceSelected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Text style={[styles.filterChoiceText, selected ? styles.filterChoiceTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1
  },
  listContent: {
    paddingBottom: 132
  },
  listHeader: {
    gap: 16,
    paddingBottom: 16
  },
  listSeparator: {
    height: 14
  },
  filtersCard: {
    gap: 14
  },
  filtersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  filterHeaderCopy: {
    flex: 1,
    gap: 4
  },
  summaryLabel: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 22,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  resultsPill: {
    minWidth: 68,
    minHeight: 62,
    borderRadius: mobileTheme.radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border
  },
  resultsPillValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    color: mobileTheme.colors.brandStrong
  },
  resultsPillLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
    color: mobileTheme.colors.brandStrong
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
    paddingRight: 8,
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
  clearSearchButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: mobileTheme.radii.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  filterButton: {
    minHeight: 64,
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surfaceTint,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  filterButtonCopy: {
    flex: 1,
    gap: 4
  },
  filterValue: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 22,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  card: {
    gap: 16
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileTheme.colors.readySoft
  },
  avatarText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: mobileTheme.colors.ready
  },
  headerMeta: {
    flex: 1,
    gap: 4
  },
  headerChips: {
    alignItems: "flex-end",
    gap: 8
  },
  name: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
    color: mobileTheme.colors.ink
  },
  contact: {
    fontSize: 13,
    lineHeight: 18,
    color: mobileTheme.colors.mutedInk
  },
  attentionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: mobileTheme.radii.control,
    backgroundColor: mobileTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  attentionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: mobileTheme.colors.brandStrong
  },
  summary: {
    fontSize: mobileTheme.typography.body,
    lineHeight: 22,
    color: mobileTheme.colors.mutedInk
  },
  primaryActions: {
    gap: 10
  },
  footer: {
    gap: 10,
    paddingTop: 16,
    paddingBottom: 24
  },
  footerHint: {
    textAlign: "center",
    fontSize: mobileTheme.typography.bodySmall,
    lineHeight: 21,
    color: mobileTheme.colors.mutedInk
  },
  sheetSection: {
    gap: 10,
    paddingBottom: 4
  },
  sheetLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
    color: mobileTheme.colors.brandStrong
  },
  optionGrid: {
    gap: 8
  },
  filterChoice: {
    minHeight: 48,
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  filterChoiceSelected: {
    backgroundColor: mobileTheme.colors.brand,
    borderColor: mobileTheme.colors.brand
  },
  filterChoiceText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: mobileTheme.colors.ink,
    textAlign: "center"
  },
  filterChoiceTextSelected: {
    color: mobileTheme.colors.inverse
  },
  sheetActions: {
    gap: 10
  },
  pressed: {
    opacity: 0.88
  }
})
