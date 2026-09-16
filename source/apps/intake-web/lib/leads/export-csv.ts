import type { Lead } from "@showready/contracts"

export const LEAD_EXPORT_CSV_HEADERS = [
  "First Name",
  "Last Name",
  "Full Name",
  "Email",
  "Phone",
  "Company",
  "Lead Type",
  "Source",
  "Stage",
  "Pipeline",
  "Tags",
  "Assigned Agent",
  "Created Date",
  "Submitted Date",
  "ShowReady Lead ID",
  "ShowReady Stage",
  "ShowReady Score",
  "ShowReady Recommendation",
  "Timeframe",
  "Neighborhoods",
  "Property Type",
  "Bedrooms",
  "Bathrooms",
  "Budget Or Rent Range",
  "Financing Or Readiness",
  "Must Haves",
  "Worked With Another Realtor",
  "Additional Context",
  "Notes"
] as const

type LeadExportOptions = {
  agentFullName?: string
}

function csvCell(value: string | number | undefined | null) {
  if (value === undefined || value === null) {
    return ""
  }

  const text = String(value)

  if (!/[",\n\r]/.test(text)) {
    return text
  }

  return `"${text.replaceAll("\"", "\"\"")}"`
}

function rowToCsv(values: ReadonlyArray<string | number | undefined | null>) {
  return values.map(csvCell).join(",")
}

function compactJoin(values: Array<string | undefined | null>, separator = "; ") {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(separator)
}

function arrayJoin(value: string[] | undefined) {
  return value && value.length > 0 ? value.join("; ") : ""
}

function formatDate(value?: string) {
  if (!value) {
    return ""
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  const year = date.getUTCFullYear()

  return `${month}/${day}/${year}`
}

function stageLabel(stage: Lead["pipelineStage"]) {
  const labels: Record<Lead["pipelineStage"], string> = {
    new: "New",
    ready_to_show: "Ready to Show",
    appointment_booked: "Appointment Booked",
    nurture: "Nurture",
    hold: "Hold",
    closed_won: "Closed Won",
    closed_lost: "Closed Lost",
    archived: "Archived"
  }

  return labels[stage] ?? stage
}

function leadType(lead: Lead) {
  return lead.intakeType === "rental" ? "Renter" : "Buyer"
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return {
      firstName: "",
      lastName: ""
    }
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0].replace(/[,\s]+$/g, ""),
      lastName: ""
    }
  }

  return {
    firstName: parts[0].replace(/[,\s]+$/g, ""),
    lastName: parts[parts.length - 1].replace(/[,\s]+$/g, "")
  }
}

function leadTags(lead: Lead) {
  return compactJoin([
    "ShowReady",
    leadType(lead),
    stageLabel(lead.pipelineStage),
    typeof lead.score === "number" ? `Score ${lead.score}` : undefined
  ])
}

function buyerValues(lead: Lead) {
  const buyer = lead.answers?.buyer

  return {
    timeframe: buyer?.timeline,
    neighborhoods: buyer?.neighborhoods,
    propertyType: arrayJoin(buyer?.propertyType),
    bedrooms: buyer?.bedrooms,
    bathrooms: buyer?.bathrooms,
    budgetOrRentRange: buyer?.budgetKnowledge,
    financingOrReadiness: buyer?.mortgageStatus,
    mustHaves: arrayJoin(buyer?.mustHaves),
    workedWithAnotherRealtor: buyer?.workedWithAnotherRealtor,
    additionalContext: buyer?.additionalContext
  }
}

function rentalReadiness(lead: Lead) {
  const rental = lead.answers?.rental

  return compactJoin([
    rental?.incomeProof ? `Income proof: ${rental.incomeProof}` : undefined,
    rental?.hasPets ? `Pets: ${rental.hasPets}` : undefined,
    rental?.occupantCount ? `Occupants: ${rental.occupantCount}` : undefined,
    rental?.rentedInCanadaBefore ? `Rented in Canada: ${rental.rentedInCanadaBefore}` : undefined
  ])
}

function rentalValues(lead: Lead) {
  const rental = lead.answers?.rental

  return {
    timeframe: rental?.moveTimeline,
    neighborhoods: rental?.neighborhoods,
    propertyType: arrayJoin(rental?.placeType),
    bedrooms: rental?.bedrooms,
    bathrooms: "",
    budgetOrRentRange: rental?.rentRange,
    financingOrReadiness: rentalReadiness(lead),
    mustHaves: arrayJoin(rental?.mustHaves),
    workedWithAnotherRealtor: "",
    additionalContext: rental?.additionalContext
  }
}

function questionnaireValues(lead: Lead) {
  return lead.intakeType === "rental" ? rentalValues(lead) : buyerValues(lead)
}

function customAnswerNotes(lead: Lead) {
  return Object.entries(lead.customAnswers ?? {})
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("; ") : value}`)
    .join(" | ")
}

function notesForLead(lead: Lead) {
  const values = questionnaireValues(lead)
  const notes = [
    typeof lead.score === "number" ? `ShowReady score: ${lead.score}/10` : undefined,
    lead.recommendation ? `Recommendation: ${lead.recommendation}` : undefined,
    lead.summary ? `Summary: ${lead.summary}` : undefined,
    lead.answers?.intent ? `Intent: ${lead.answers.intent}` : undefined,
    values.timeframe ? `Timeframe: ${values.timeframe}` : undefined,
    values.neighborhoods ? `Neighborhoods: ${values.neighborhoods}` : undefined,
    values.propertyType ? `Property type: ${values.propertyType}` : undefined,
    values.budgetOrRentRange ? `Budget/rent: ${values.budgetOrRentRange}` : undefined,
    values.financingOrReadiness ? `Readiness: ${values.financingOrReadiness}` : undefined,
    values.additionalContext ? `Additional context: ${values.additionalContext}` : undefined,
    customAnswerNotes(lead)
  ]

  return compactJoin(notes, " | ")
}

function leadRow(lead: Lead, options: LeadExportOptions) {
  const { firstName, lastName } = splitName(lead.buyerName)
  const values = questionnaireValues(lead)
  const displayStage = stageLabel(lead.pipelineStage)

  return [
    firstName,
    lastName,
    lead.buyerName,
    lead.buyerEmail,
    lead.buyerPhone,
    "Residential Client",
    leadType(lead),
    "ShowReady",
    displayStage,
    displayStage,
    leadTags(lead),
    options.agentFullName,
    formatDate(lead.createdAt),
    formatDate(lead.submittedAt),
    lead.id,
    lead.pipelineStage,
    lead.score,
    lead.recommendation,
    values.timeframe,
    values.neighborhoods,
    values.propertyType,
    values.bedrooms,
    values.bathrooms,
    values.budgetOrRentRange,
    values.financingOrReadiness,
    values.mustHaves,
    values.workedWithAnotherRealtor,
    values.additionalContext,
    notesForLead(lead)
  ]
}

export function buildLeadExportCsv(leads: Lead[], options: LeadExportOptions = {}) {
  const rows = [LEAD_EXPORT_CSV_HEADERS, ...leads.map((lead) => leadRow(lead, options))]
  return `${rows.map(rowToCsv).join("\n")}\n`
}
