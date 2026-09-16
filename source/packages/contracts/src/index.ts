import { z } from "zod"

export type LeadStatus = "pending" | "submitted" | "archived"
export type LeadStage =
  | "new"
  | "ready_to_show"
  | "appointment_booked"
  | "nurture"
  | "hold"
  | "closed_won"
  | "closed_lost"
  | "archived"
export type Recommendation = "show" | "nurture" | "hold"
export type IntakeType = "sale" | "rental"
export type IntakeIntent = "buy" | "rent"
export type InviteStatus = "generated" | "opened" | "converted" | "expired"
export type AppointmentStatus = "scheduled" | "completed" | "cancelled"

export type BuyerPurchaseGoal = "myself" | "investment" | "not_sure"
export type BuyerTimeline =
  | "asap"
  | "within_1_month"
  | "1_3_months"
  | "3_6_months"
  | "6_plus_months"
  | "exploring"
export type BuyerBudgetKnowledge = "know_it" | "rough_idea" | "not_yet"
export type BuyerMortgageStatus =
  | "pre_approved"
  | "not_yet"
  | "cash"
  | "not_sure"
export type BuyerPropertyType =
  | "condo"
  | "townhouse"
  | "detached"
  | "semi_detached"
  | "multi_family"
  | "other"
export type BuyerMustHave =
  | "parking"
  | "backyard"
  | "near_transit"
  | "near_school"
  | "pet_friendly"
  | "low_maintenance"
export type WorkedWithAnotherRealtor = "yes" | "no" | "browsing"

export type RentalMoveTimeline =
  | "asap"
  | "within_2_weeks"
  | "within_1_month"
  | "1_3_months"
  | "exploring"
export type RentalPlaceType =
  | "condo"
  | "apartment"
  | "basement"
  | "house"
  | "room"
  | "not_sure"
export type PetAnswer = "yes" | "no"
export type IncomeProofAnswer = "yes" | "no" | "discuss_later"
export type RentalMustHave =
  | "parking"
  | "laundry"
  | "furnished"
  | "balcony"
  | "near_transit"
  | "pet_friendly"
export type RentedInCanadaAnswer = "yes" | "no"

export type LeadContactInfo = {
  fullName: string
  phone?: string
  email?: string
}

export type BuyerQuestionnaireAnswers = {
  buyingFor: BuyerPurchaseGoal
  timeline: BuyerTimeline
  budgetKnowledge: BuyerBudgetKnowledge
  mortgageStatus: BuyerMortgageStatus
  neighborhoods: string
  propertyType: BuyerPropertyType[]
  bedrooms?: string
  bathrooms?: string
  mustHaves?: BuyerMustHave[]
  workedWithAnotherRealtor?: WorkedWithAnotherRealtor
  additionalContext?: string
}

export type RentalQuestionnaireAnswers = {
  moveTimeline: RentalMoveTimeline
  rentRange: string
  neighborhoods: string
  placeType: RentalPlaceType[]
  bedrooms: string
  hasPets: PetAnswer
  occupantCount: string
  incomeProof?: IncomeProofAnswer
  preferredMoveInDate?: string
  mustHaves?: RentalMustHave[]
  rentedInCanadaBefore?: RentedInCanadaAnswer
  additionalContext?: string
}

export type IntakeDraft = {
  contact: LeadContactInfo
  intent?: IntakeIntent
  buyer?: Partial<BuyerQuestionnaireAnswers>
  rental?: Partial<RentalQuestionnaireAnswers>
  customAnswers?: Record<string, string | string[]>
}

export type IntakeSubmission =
  | {
      contact: LeadContactInfo
      intent: "buy"
      buyer: BuyerQuestionnaireAnswers
      customAnswers?: Record<string, string | string[]>
    }
  | {
      contact: LeadContactInfo
      intent: "rent"
      rental: RentalQuestionnaireAnswers
      customAnswers?: Record<string, string | string[]>
    }

export type ScoreBreakdown = {
  urgency: number
  finances: number
  clarity: number
  readiness: number
  fit: number
}

export type ScoreResult = {
  total: number
  breakdown: ScoreBreakdown
  recommendation: Recommendation
  summary: string
  nextAction: string
  effectiveShowThreshold: number
}

export type ScoreOverride = {
  id: string
  originalScore: number
  originalRecommendation: Recommendation
  overrideScore: number
  overrideRecommendation: Recommendation
  note: string
  createdAt: string
  createdByAgentId: string
}

export type LeadReview = {
  suggestedStage?: LeadStage
  reviewedStage?: LeadStage
  reviewedAt?: string
  isReviewed: boolean
  isOverride: boolean
}

export type ContactMethod = "call" | "text" | "email"

export type LeadContactInteraction = {
  id: string
  leadId: string
  agentId: string
  method: ContactMethod
  occurredAt: string
}

export type CustomQuestionType = "single_select" | "multi_select" | "text"

export type QuestionOption = {
  label: string
  value: string
}

export type CustomQuestion = {
  id: string
  label: string
  type: CustomQuestionType
  required: boolean
  helperText?: string
  options?: QuestionOption[]
}

export type QuestionInputType =
  | "single_select"
  | "multi_select"
  | "text"
  | "date"
  | "email"
  | "tel"
  | "textarea"

export type QuestionDefinition = {
  key: string
  label: string
  helperText?: string
  placeholder?: string
  required: boolean
  type: QuestionInputType
  options?: QuestionOption[]
}

export type QuestionTemplate = {
  id: string
  intakeType: IntakeType
  name: string
  introHeadline: string
  introBody: string
  customQuestions: CustomQuestion[]
}

export type AgentProfile = {
  id: string
  email: string
  fullName: string
  brokerage?: string
  licenseNumber?: string
  photoUrl?: string
  logoUrl?: string
  onboardedAt?: string
}

export type AgentSettings = {
  agentId: string
  brandName: string
  brandColor: string
  accentColor: string
  showThreshold: number
  emailNotificationsEnabled: boolean
  questionTemplateId: string
}

export type Lead = {
  id: string
  agentId: string
  intakeType: IntakeType
  buyerName: string
  buyerPhone?: string
  buyerEmail?: string
  token: string
  tokenExpiresAt: string
  status: LeadStatus
  pipelineStage: LeadStage
  submittedAt?: string
  score?: number
  recommendation?: Recommendation
  summary?: string
  createdAt: string
  updatedAt: string
  reviewedAt?: string
  reviewedStage?: LeadStage
  answers?: IntakeDraft
  customAnswers?: Record<string, string | string[]>
  scoreBreakdown?: ScoreBreakdown
  scoreOverride?: ScoreOverride
  review?: LeadReview
  contactInteractions?: LeadContactInteraction[]
}

export type Showing = {
  id: string
  appointmentId: string
  address: string
  orderIndex: number
  notes?: string
}

export type AppointmentLeadSummary = Pick<
  Lead,
  "id" | "buyerName" | "buyerPhone" | "buyerEmail" | "pipelineStage"
>

export type Appointment = {
  id: string
  leadId: string
  date: string
  startTime: string
  status: AppointmentStatus
  notes?: string
  createdAt: string
  lead: AppointmentLeadSummary
  showings: Showing[]
}

export type LeadListScope = "all" | "new" | "appointment_eligible"

export type LeadListQuery = {
  scope: LeadListScope
  query?: string
  limit: number
  offset: number
}

export type LeadListResponse = {
  leads: Lead[]
  total: number
  nextOffset?: number
}

export type LeadMutation = {
  buyerName: string
  buyerEmail?: string
  buyerPhone?: string
  intakeType: IntakeType
}

export type AccountDeletionRequest = {
  note?: string
}

export type AppointmentListQuery = {
  status: AppointmentStatus
  limit: number
  offset: number
}

export type AppointmentListResponse = {
  appointments: Appointment[]
  total: number
  nextOffset?: number
}

export type Invite = {
  id: string
  agentId: string
  token: string
  status: InviteStatus
  tokenExpiresAt: string
  createdAt: string
  updatedAt: string
  openedAt?: string
  convertedAt?: string
  leadId?: string
  draft?: IntakeDraft
}

export type DashboardSummary = {
  totalLeads: number
  newLeads: number
  readyToShow: number
  appointmentBooked: number
  nurture: number
  hold: number
  averageScore: number
}

export type HomeDataResponse = {
  summary: DashboardSummary
  recentLeads: Lead[]
}

export type AppointmentInitialDataResponse = {
  appointments: AppointmentListResponse
  eligibleLeads: Lead[]
}

export type PipelineTab = "active" | "resolved"
export type PipelineCategory =
  | "all"
  | "ready_to_show"
  | "nurture"
  | "hold"
  | "closed_won"
  | "closed_lost"
  | "archived"
  | "buy"
  | "rent"
export type PipelineMode = "focus_queue" | "filtered_results"
export type PipelineLead = Pick<
  Lead,
  | "id"
  | "agentId"
  | "intakeType"
  | "buyerName"
  | "buyerPhone"
  | "buyerEmail"
  | "status"
  | "pipelineStage"
  | "submittedAt"
  | "score"
  | "recommendation"
  | "summary"
  | "createdAt"
  | "updatedAt"
  | "reviewedAt"
  | "reviewedStage"
  | "review"
> & {
  lastMovementAt?: string
  attentionReason?: string
  latestContactInteraction?: LeadContactInteraction
}
export type PipelineLeadListQuery = {
  tab: PipelineTab
  category: PipelineCategory
  query?: string
  submittedFrom?: string
  submittedTo?: string
  limit: number
  offset: number
}
export type PipelineLeadListResponse = {
  leads: PipelineLead[]
  total: number
  nextOffset?: number
  mode: PipelineMode
  summaryLabel: string
}

export const CONTACT_QUESTIONS: QuestionDefinition[] = [
  {
    key: "contact.fullName",
    label: "What’s your full name?",
    placeholder: "Full name",
    required: true,
    type: "text"
  },
  {
    key: "contact.phone",
    label: "What’s the best phone number to reach you?",
    placeholder: "Phone number",
    required: false,
    type: "tel"
  },
  {
    key: "contact.email",
    label: "What’s the best email to reach you?",
    placeholder: "Email address",
    required: false,
    type: "email"
  }
]

export const INTENT_QUESTION: QuestionDefinition = {
  key: "intent",
  label: "Are you buying a property or renting?",
  helperText: "Choose the path that matches your search right now.",
  required: true,
  type: "single_select",
  options: [
    { label: "Buying a property", value: "buy" },
    { label: "Renting", value: "rent" }
  ]
}

export const BUYER_REQUIRED_QUESTIONS: QuestionDefinition[] = [
  {
    key: "buyer.buyingFor",
    label: "Are you looking to buy for yourself or as an investment?",
    required: true,
    type: "single_select",
    options: [
      { label: "Myself", value: "myself" },
      { label: "Investment", value: "investment" },
      { label: "Not sure yet", value: "not_sure" }
    ]
  },
  {
    key: "buyer.timeline",
    label: "When are you hoping to move or buy?",
    required: true,
    type: "single_select",
    options: [
      { label: "ASAP", value: "asap" },
      { label: "Within 1 month", value: "within_1_month" },
      { label: "1–3 months", value: "1_3_months" },
      { label: "3–6 months", value: "3_6_months" },
      { label: "6+ months", value: "6_plus_months" },
      { label: "Just exploring", value: "exploring" }
    ]
  },
  {
    key: "buyer.budgetKnowledge",
    label: "Do you know your budget range?",
    required: true,
    type: "single_select",
    options: [
      { label: "Yes, I know it", value: "know_it" },
      { label: "I have a rough idea", value: "rough_idea" },
      { label: "Not yet", value: "not_yet" }
    ]
  },
  {
    key: "buyer.mortgageStatus",
    label: "Have you been pre-approved for a mortgage?",
    required: true,
    type: "single_select",
    options: [
      { label: "Yes", value: "pre_approved" },
      { label: "Not yet", value: "not_yet" },
      { label: "Paying cash", value: "cash" },
      { label: "Not sure what this means", value: "not_sure" }
    ]
  },
  {
    key: "buyer.neighborhoods",
    label: "Which area or neighborhoods are you interested in?",
    placeholder: "Neighborhoods, areas, or cities",
    required: true,
    type: "text"
  },
  {
    key: "buyer.propertyType",
    label: "What type of property are you looking for?",
    required: true,
    type: "multi_select",
    options: [
      { label: "Condo", value: "condo" },
      { label: "Townhouse", value: "townhouse" },
      { label: "Detached", value: "detached" },
      { label: "Semi-detached", value: "semi_detached" },
      { label: "Multi-family", value: "multi_family" }
    ]
  }
]

export const BUYER_OPTIONAL_QUESTIONS: QuestionDefinition[] = [
  {
    key: "buyer.bedrooms",
    label: "How many bedrooms do you want?",
    placeholder: "For example: 2+",
    required: false,
    type: "text"
  },
  {
    key: "buyer.bathrooms",
    label: "How many bathrooms do you want?",
    placeholder: "For example: 2+",
    required: false,
    type: "text"
  },
  {
    key: "buyer.mustHaves",
    label: "Any must-haves?",
    required: false,
    type: "multi_select",
    options: [
      { label: "Parking", value: "parking" },
      { label: "Backyard", value: "backyard" },
      { label: "Near transit", value: "near_transit" },
      { label: "Near school", value: "near_school" },
      { label: "Pet-friendly", value: "pet_friendly" },
      { label: "Low maintenance", value: "low_maintenance" }
    ]
  },
  {
    key: "buyer.workedWithAnotherRealtor",
    label: "Have you worked with another realtor already?",
    required: false,
    type: "single_select",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "Just casually browsing", value: "browsing" }
    ]
  },
  {
    key: "buyer.additionalContext",
    label: "Anything else you want your realtor to know?",
    required: false,
    type: "textarea"
  }
]

export const RENTAL_REQUIRED_QUESTIONS: QuestionDefinition[] = [
  {
    key: "rental.moveTimeline",
    label: "When do you need to move?",
    required: true,
    type: "single_select",
    options: [
      { label: "ASAP", value: "asap" },
      { label: "Within 2 weeks", value: "within_2_weeks" },
      { label: "Within 1 month", value: "within_1_month" },
      { label: "1–3 months", value: "1_3_months" },
      { label: "Just exploring", value: "exploring" }
    ]
  },
  {
    key: "rental.rentRange",
    label: "What monthly rent range are you comfortable with?",
    placeholder: "For example: $2,000–$2,500/mo",
    required: true,
    type: "text"
  },
  {
    key: "rental.neighborhoods",
    label: "Which area or neighborhoods do you want?",
    placeholder: "Neighborhoods, areas, or cities",
    required: true,
    type: "text"
  },
  {
    key: "rental.placeType",
    label: "What type of place are you looking for?",
    required: true,
    type: "multi_select",
    options: [
      { label: "Condo", value: "condo" },
      { label: "Apartment", value: "apartment" },
      { label: "Basement", value: "basement" },
      { label: "House", value: "house" },
      { label: "Room", value: "room" }
    ]
  },
  {
    key: "rental.bedrooms",
    label: "How many bedrooms do you need?",
    placeholder: "For example: 2",
    required: true,
    type: "text"
  },
  {
    key: "rental.hasPets",
    label: "Do you have any pets?",
    required: true,
    type: "single_select",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" }
    ]
  },
  {
    key: "rental.occupantCount",
    label: "How many people will be living there?",
    placeholder: "For example: 2",
    required: true,
    type: "text"
  }
]

export const RENTAL_OPTIONAL_QUESTIONS: QuestionDefinition[] = [
  {
    key: "rental.incomeProof",
    label: "Are you currently employed or able to provide proof of income?",
    required: false,
    type: "single_select",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "Prefer to discuss later", value: "discuss_later" }
    ]
  },
  {
    key: "rental.preferredMoveInDate",
    label: "Do you have a preferred move-in date?",
    placeholder: "YYYY-MM-DD",
    required: false,
    type: "date"
  },
  {
    key: "rental.mustHaves",
    label: "Any must-haves?",
    required: false,
    type: "multi_select",
    options: [
      { label: "Parking", value: "parking" },
      { label: "Laundry", value: "laundry" },
      { label: "Furnished", value: "furnished" },
      { label: "Balcony", value: "balcony" },
      { label: "Near transit", value: "near_transit" },
      { label: "Pet-friendly", value: "pet_friendly" }
    ]
  },
  {
    key: "rental.rentedInCanadaBefore",
    label: "Have you rented in Canada before?",
    required: false,
    type: "single_select",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" }
    ]
  },
  {
    key: "rental.additionalContext",
    label: "Anything else you want your realtor to know?",
    required: false,
    type: "textarea"
  }
]

export const DEFAULT_SALE_TEMPLATE: QuestionTemplate = {
  id: "default-sale-template",
  intakeType: "sale",
  name: "ShowReady Buyer",
  introHeadline: "A quick step before your home search starts",
  introBody:
    "This takes about one minute and helps your agent understand your timing, budget, and search priorities.",
  customQuestions: []
}

export const DEFAULT_RENTAL_TEMPLATE: QuestionTemplate = {
  id: "default-rental-template",
  intakeType: "rental",
  name: "ShowReady Rental",
  introHeadline: "A quick step before your rental search starts",
  introBody:
    "This takes about one minute and helps your agent focus on rentals that fit your timing, budget, and move-in needs.",
  customQuestions: []
}

export const DEFAULT_TEMPLATES: Record<IntakeType, QuestionTemplate> = {
  sale: DEFAULT_SALE_TEMPLATE,
  rental: DEFAULT_RENTAL_TEMPLATE
}

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const optionalLimitedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()

const limitedString = (max: number) => z.string().trim().max(max)
const requiredLimitedString = (max: number) => limitedString(max).min(1)
const URL_LIKE_PATTERN = /\b(?:https?:\/\/|www\.)/i
const PHONE_ALLOWED_PATTERN = /^[+()\d\s.-]+$/

function countDigits(value: string) {
  return value.replace(/\D/g, "").length
}

export const ResourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(72)
  .regex(RESOURCE_ID_PATTERN, "Resource id contains unsupported characters.")

const EmailSchema = z.string().trim().email().max(254)
const OptionalEmailSchema = EmailSchema.optional()
const ContactNameSchema = limitedString(120).refine(
  (value) => !URL_LIKE_PATTERN.test(value),
  "Name cannot include URLs."
)
const PhoneSchema = z
  .string()
  .trim()
  .max(32)
  .refine(
    (value) =>
      value === "" || (PHONE_ALLOWED_PATTERN.test(value) && countDigits(value) >= 7),
    "Phone number must include at least 7 digits and only phone characters."
  )
  .optional()

const BuyerPurchaseGoalSchema = z.enum(["myself", "investment", "not_sure"])
const BuyerTimelineSchema = z.enum([
  "asap",
  "within_1_month",
  "1_3_months",
  "3_6_months",
  "6_plus_months",
  "exploring"
])
const BuyerBudgetKnowledgeSchema = z.enum(["know_it", "rough_idea", "not_yet"])
const BuyerMortgageStatusSchema = z.enum(["pre_approved", "not_yet", "cash", "not_sure"])
const BuyerPropertyTypeSchema = z.enum([
  "condo",
  "townhouse",
  "detached",
  "semi_detached",
  "multi_family",
  "other"
])
const BuyerMustHaveSchema = z.enum([
  "parking",
  "backyard",
  "near_transit",
  "near_school",
  "pet_friendly",
  "low_maintenance"
])
const WorkedWithAnotherRealtorSchema = z.enum(["yes", "no", "browsing"])
const RentalMoveTimelineSchema = z.enum([
  "asap",
  "within_2_weeks",
  "within_1_month",
  "1_3_months",
  "exploring"
])
const RentalPlaceTypeSchema = z.enum([
  "condo",
  "apartment",
  "basement",
  "house",
  "room",
  "not_sure"
])
const PetAnswerSchema = z.enum(["yes", "no"])
const IncomeProofAnswerSchema = z.enum(["yes", "no", "discuss_later"])
const RentalMustHaveSchema = z.enum([
  "parking",
  "laundry",
  "furnished",
  "balcony",
  "near_transit",
  "pet_friendly"
])
const RentedInCanadaAnswerSchema = z.enum(["yes", "no"])
const IntakeIntentSchema = z.enum(["buy", "rent"])

const CustomAnswerValueSchema = z.union([
  limitedString(1000),
  z.array(limitedString(250)).max(20)
])
const CustomAnswersSchema = z
  .record(
    z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
    CustomAnswerValueSchema
  )
  .superRefine((value, context) => {
    if (Object.keys(value).length > 20) {
      context.addIssue({
        code: "custom",
        message: "Custom answers cannot contain more than 20 fields."
      })
    }
  })

const IntakeContactSchema = z.strictObject({
  fullName: ContactNameSchema,
  phone: PhoneSchema,
  email: OptionalEmailSchema
})
const BuyerDraftSchema = z.strictObject({
  buyingFor: BuyerPurchaseGoalSchema.optional(),
  timeline: BuyerTimelineSchema.optional(),
  budgetKnowledge: BuyerBudgetKnowledgeSchema.optional(),
  mortgageStatus: BuyerMortgageStatusSchema.optional(),
  neighborhoods: optionalLimitedString(160),
  propertyType: z.array(BuyerPropertyTypeSchema).max(8).optional(),
  bedrooms: optionalLimitedString(32),
  bathrooms: optionalLimitedString(32),
  mustHaves: z.array(BuyerMustHaveSchema).max(8).optional(),
  workedWithAnotherRealtor: WorkedWithAnotherRealtorSchema.optional(),
  additionalContext: optionalLimitedString(1000)
})
const RentalDraftSchema = z.strictObject({
  moveTimeline: RentalMoveTimelineSchema.optional(),
  rentRange: optionalLimitedString(80),
  neighborhoods: optionalLimitedString(160),
  placeType: z.array(RentalPlaceTypeSchema).max(8).optional(),
  bedrooms: optionalLimitedString(32),
  hasPets: PetAnswerSchema.optional(),
  occupantCount: optionalLimitedString(32),
  incomeProof: IncomeProofAnswerSchema.optional(),
  preferredMoveInDate: optionalLimitedString(40),
  mustHaves: z.array(RentalMustHaveSchema).max(8).optional(),
  rentedInCanadaBefore: RentedInCanadaAnswerSchema.optional(),
  additionalContext: optionalLimitedString(1000)
})

export const IntakeDraftSchema = z.strictObject({
  contact: IntakeContactSchema,
  intent: IntakeIntentSchema.optional(),
  buyer: BuyerDraftSchema.optional(),
  rental: RentalDraftSchema.optional(),
  customAnswers: CustomAnswersSchema.optional()
})

export const PublicIntakePayloadSchema = z.strictObject({
  draft: IntakeDraftSchema,
  guard: z
    .strictObject({
      startedAt: z.number().finite().optional(),
      website: z.string().max(2048).optional()
    })
    .optional()
})

export const DashboardSummarySchema = z.object({
  totalLeads: z.number().int().nonnegative(),
  newLeads: z.number().int().nonnegative(),
  readyToShow: z.number().int().nonnegative(),
  appointmentBooked: z.number().int().nonnegative(),
  nurture: z.number().int().nonnegative(),
  hold: z.number().int().nonnegative(),
  averageScore: z.number().nonnegative()
})

const PipelineLimitSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return 25
    }

    return Math.min(Number(value), 50)
  },
  z.number().int().min(1).max(50)
)
const PipelineOffsetSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return 0
    }

    return Number(value)
  },
  z.number().int().nonnegative().max(10_000)
)
const OptionalTrimmedStringSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  },
  z.string().max(120).optional()
)
const OptionalDateTimeStringSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  },
  z.string().datetime().optional()
)

export const PipelineTabSchema = z.enum(["active", "resolved"])
export const LeadStageSchema = z.enum([
  "new",
  "ready_to_show",
  "appointment_booked",
  "nurture",
  "hold",
  "closed_won",
  "closed_lost",
  "archived"
])
export const LeadStatusSchema = z.enum(["pending", "submitted", "archived"])
export const RecommendationSchema = z.enum(["show", "nurture", "hold"])
export const ContactMethodSchema = z.enum(["call", "text", "email"])
export const LeadContactInteractionSchema = z.strictObject({
  id: z.string().min(1),
  leadId: z.string().min(1),
  agentId: z.string().min(1),
  method: ContactMethodSchema,
  occurredAt: z.string().datetime({ offset: true })
})
export const LeadContactInteractionCreateSchema = z.strictObject({
  method: ContactMethodSchema
})
export const IntakeTypeSchema = z.enum(["sale", "rental"])
export const AppointmentStatusValueSchema = z.enum(["scheduled", "completed", "cancelled"])
export const LeadListScopeSchema = z.enum(["all", "new", "appointment_eligible"])
export const LeadListQuerySchema = z.strictObject({
  scope: LeadListScopeSchema.default("all"),
  query: OptionalTrimmedStringSchema,
  limit: PipelineLimitSchema,
  offset: PipelineOffsetSchema
})
export const LeadExportQuerySchema = z.strictObject({
  from: z.string().regex(DATE_ONLY_PATTERN, "Export dates must use YYYY-MM-DD format."),
  to: z.string().regex(DATE_ONLY_PATTERN, "Export dates must use YYYY-MM-DD format."),
  timeZone: OptionalTrimmedStringSchema
})
export const AppointmentListQuerySchema = z.strictObject({
  status: AppointmentStatusValueSchema.default("scheduled"),
  limit: PipelineLimitSchema,
  offset: PipelineOffsetSchema
})
export const PipelineCategorySchema = z.enum([
  "all",
  "ready_to_show",
  "nurture",
  "hold",
  "closed_won",
  "closed_lost",
  "archived",
  "buy",
  "rent"
])
export const PipelineModeSchema = z.enum(["focus_queue", "filtered_results"])
export const PipelineLeadListQuerySchema = z.strictObject({
  tab: PipelineTabSchema.default("active"),
  category: PipelineCategorySchema.default("all"),
  query: OptionalTrimmedStringSchema,
  submittedFrom: OptionalDateTimeStringSchema,
  submittedTo: OptionalDateTimeStringSchema,
  limit: PipelineLimitSchema,
  offset: PipelineOffsetSchema
})
export const PipelineLeadSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  intakeType: IntakeTypeSchema,
  buyerName: z.string().min(1),
  buyerPhone: z.string().optional(),
  buyerEmail: z.string().optional(),
  status: LeadStatusSchema,
  pipelineStage: LeadStageSchema,
  submittedAt: z.string().optional(),
  score: z.number().optional(),
  recommendation: RecommendationSchema.optional(),
  summary: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  reviewedAt: z.string().optional(),
  reviewedStage: LeadStageSchema.optional(),
  review: z
    .object({
      suggestedStage: LeadStageSchema.optional(),
      reviewedStage: LeadStageSchema.optional(),
      reviewedAt: z.string().optional(),
      isReviewed: z.boolean(),
      isOverride: z.boolean()
    })
    .optional(),
  lastMovementAt: z.string().optional(),
  attentionReason: z.string().optional(),
  latestContactInteraction: LeadContactInteractionSchema.optional()
})
export const LeadSchema = PipelineLeadSchema.extend({
  token: z.string().min(1),
  tokenExpiresAt: z.string().min(1),
  answers: IntakeDraftSchema.optional(),
  customAnswers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  scoreBreakdown: z
    .object({
      urgency: z.number(),
      finances: z.number(),
      clarity: z.number(),
      readiness: z.number(),
      fit: z.number()
    })
    .optional(),
  scoreOverride: z
    .object({
      id: z.string().min(1),
      originalScore: z.number(),
      originalRecommendation: RecommendationSchema,
      overrideScore: z.number(),
      overrideRecommendation: RecommendationSchema,
      note: z.string(),
      createdAt: z.string(),
      createdByAgentId: z.string()
    })
    .optional(),
  contactInteractions: z.array(LeadContactInteractionSchema).optional()
}).omit({
  lastMovementAt: true,
  attentionReason: true,
  latestContactInteraction: true
})
export const LeadListResponseSchema = z.object({
  leads: z.array(LeadSchema),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().positive().optional()
})
export const ShowingSchema = z.object({
  id: z.string().min(1),
  appointmentId: z.string().min(1),
  address: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  notes: z.string().optional()
})
export const AppointmentLeadSummarySchema = z.object({
  id: z.string().min(1),
  buyerName: z.string().min(1),
  buyerPhone: z.string().optional(),
  buyerEmail: z.string().optional(),
  pipelineStage: LeadStageSchema
})
export const AppointmentSchema = z.object({
  id: z.string().min(1),
  leadId: z.string().min(1),
  date: z.string().regex(DATE_ONLY_PATTERN, "Date must use YYYY-MM-DD format."),
  startTime: z.string().regex(TIME_24H_PATTERN, "Start time must use HH:mm format."),
  status: AppointmentStatusValueSchema,
  notes: z.string().optional(),
  createdAt: z.string().min(1),
  lead: AppointmentLeadSummarySchema,
  showings: z.array(ShowingSchema)
})
export const AppointmentListResponseSchema = z.object({
  appointments: z.array(AppointmentSchema),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().positive().optional()
})
export const PipelineLeadListResponseSchema = z.object({
  leads: z.array(PipelineLeadSchema),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().positive().optional(),
  mode: PipelineModeSchema,
  summaryLabel: z.string().min(1)
})

export const HomeDataResponseSchema = z.object({
  summary: DashboardSummarySchema,
  recentLeads: z.array(LeadSchema)
})

export const AppointmentInitialDataResponseSchema = z.object({
  appointments: AppointmentListResponseSchema,
  eligibleLeads: z.array(LeadSchema)
})

export const CreateInviteResponseSchema = z.object({
  token: z.string().min(1),
  shareUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  agentName: z.string().min(1).max(120).optional()
})

export const LeadMutationSchema = z
  .strictObject({
    buyerName: requiredLimitedString(120),
    buyerEmail: OptionalEmailSchema,
    buyerPhone: PhoneSchema,
    intakeType: IntakeTypeSchema.default("sale")
  })
  .refine(
    (input) => Boolean(input.buyerEmail?.trim() || input.buyerPhone?.trim()),
    {
      message: "Add an email or phone number.",
      path: ["buyerEmail"]
    }
  )

export const AccountDeletionRequestSchema = z.strictObject({
  note: optionalLimitedString(1000)
})

export const LeadStageMutationSchema = z.strictObject({
  pipelineStage: z.enum([
    "ready_to_show",
    "nurture",
    "hold",
    "closed_won",
    "closed_lost",
    "archived"
  ])
})

export const ReviewLeadSchema = z.strictObject({
  leadId: ResourceIdSchema,
  pipelineStage: z.enum(["ready_to_show", "nurture", "hold"])
})

export const AppointmentMutationSchema = z.strictObject({
  appointmentId: ResourceIdSchema.optional(),
  leadId: ResourceIdSchema,
  date: z.string().regex(DATE_ONLY_PATTERN, "Date must use YYYY-MM-DD format."),
  startTime: z.string().regex(TIME_24H_PATTERN, "Start time must use HH:mm format."),
  notes: optionalLimitedString(1000),
  showings: z
    .array(
      z.strictObject({
        address: requiredLimitedString(200),
        notes: optionalLimitedString(1000)
      })
    )
    .min(1)
    .max(10)
})

export const AppointmentStatusSchema = z.strictObject({
  appointmentId: ResourceIdSchema,
  status: z.enum(["scheduled", "completed", "cancelled"])
})

export const SettingsMutationSchema = z.strictObject({
  fullName: requiredLimitedString(120),
  brokerage: optionalLimitedString(120),
  licenseNumber: optionalLimitedString(64),
  emailNotificationsEnabled: z.boolean()
})

export const FeedbackSubmissionSchema = z.strictObject({
  message: limitedString(2000).min(1, "Feedback message is required.")
})

export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>

export const FeedbackSubmissionResponseSchema = z.strictObject({
  ok: z.literal(true)
})

export type FeedbackSubmissionResponse = z.infer<typeof FeedbackSubmissionResponseSchema>

export type DiagnosticsSeverity = "debug" | "info" | "warning" | "error" | "fatal"
export type DiagnosticsCategory =
  | "api"
  | "error"
  | "auth"
  | "navigation"
  | "action"
  | "notification"
  | "diagnostics"
  | "crash"
export type DiagnosticsEventType =
  | "crash.inferred"
  | "error.unhandled"
  | "error.handled"
  | "api.failure"
  | "auth.event"
  | "navigation.screen"
  | "action.event"
  | "notification.event"
  | "diagnostics.internal"
export type DiagnosticsPlatform = "ios" | "android" | "web" | "unknown"
export type DiagnosticsMetadataValue =
  | string
  | number
  | boolean
  | null
  | DiagnosticsMetadataValue[]
  | { [key: string]: DiagnosticsMetadataValue }
export type DiagnosticsMetadata = Record<string, DiagnosticsMetadataValue>
export type DiagnosticsBreadcrumb = {
  timestamp: string
  type: string
  message: string
  data?: DiagnosticsMetadata
}

export const DiagnosticsSeveritySchema = z.enum(["debug", "info", "warning", "error", "fatal"])
export const DiagnosticsCategorySchema = z.enum([
  "api",
  "error",
  "auth",
  "navigation",
  "action",
  "notification",
  "diagnostics",
  "crash"
])
export const DiagnosticsEventTypeSchema = z.enum([
  "crash.inferred",
  "error.unhandled",
  "error.handled",
  "api.failure",
  "auth.event",
  "navigation.screen",
  "action.event",
  "notification.event",
  "diagnostics.internal"
])
export const DiagnosticsPlatformSchema = z.enum(["ios", "android", "web", "unknown"])

export const DiagnosticsMetadataValueSchema: z.ZodType<DiagnosticsMetadataValue> = z.lazy(() =>
  z.union([
    z.string().max(2000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(DiagnosticsMetadataValueSchema).max(20),
    z.record(z.string().min(1).max(64), DiagnosticsMetadataValueSchema)
  ])
)

export const DiagnosticsMetadataSchema: z.ZodType<DiagnosticsMetadata> = z.record(
  z.string(),
  DiagnosticsMetadataValueSchema
)

export const DiagnosticsBreadcrumbSchema = z.strictObject({
  timestamp: z.string().datetime(),
  type: requiredLimitedString(64),
  message: requiredLimitedString(500),
  data: DiagnosticsMetadataSchema.optional()
})

export const DiagnosticsEventSchema = z.strictObject({
  id: z.string().uuid(),
  sessionId: requiredLimitedString(128),
  deviceId: requiredLimitedString(128),
  occurredAt: z.string().datetime(),
  eventType: DiagnosticsEventTypeSchema,
  category: DiagnosticsCategorySchema,
  severity: DiagnosticsSeveritySchema,
  message: requiredLimitedString(2000),
  fingerprint: requiredLimitedString(256).optional(),
  screen: requiredLimitedString(160).optional(),
  appVersion: requiredLimitedString(64).optional(),
  buildNumber: requiredLimitedString(64).optional(),
  platform: DiagnosticsPlatformSchema,
  requestPath: requiredLimitedString(160).optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  leadId: ResourceIdSchema.optional(),
  appointmentId: ResourceIdSchema.optional(),
  pipelineStage: z.string().min(1).max(64).optional(),
  context: DiagnosticsMetadataSchema.default({}),
  breadcrumbs: z.array(DiagnosticsBreadcrumbSchema).max(50).default([]),
  tags: DiagnosticsMetadataSchema.default({})
})

export type DiagnosticsEvent = z.infer<typeof DiagnosticsEventSchema>

export const DiagnosticsBatchSchema = z.strictObject({
  events: z
    .array(DiagnosticsEventSchema)
    .min(1, "Diagnostics batch must contain at least one event.")
    .max(50, "Diagnostics batch cannot contain more than 50 events.")
})

export type DiagnosticsBatch = z.infer<typeof DiagnosticsBatchSchema>

export const DiagnosticsBatchResponseSchema = z.object({
  acceptedCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  rejectedEventIds: z.array(z.string())
})

export type DiagnosticsBatchResponse = z.infer<typeof DiagnosticsBatchResponseSchema>

export const EventMetadataSchema = z.record(
  z.string().min(1).max(64),
  DiagnosticsMetadataValueSchema
)

export type EventMetadata = z.infer<typeof EventMetadataSchema>

export const ProductEventNameSchema = z.enum([
  "invite.created",
  "invite.shared",
  "intake.opened",
  "intake.step_viewed",
  "intake.step_completed",
  "intake.autosaved",
  "intake.submitted",
  "lead.created",
  "lead.viewed",
  "lead.reviewed",
  "lead.stage_changed",
  "lead.score_overridden",
  "appointment.created",
  "appointment.updated",
  "settings.updated",
  "notification.permission_requested",
  "notification.token_registered",
  "notification.sent",
  "notification.tapped"
])

export type ProductEventName = z.infer<typeof ProductEventNameSchema>

export const ProductEventSchema = z.strictObject({
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
  eventName: ProductEventNameSchema,
  agentId: ResourceIdSchema.optional(),
  workspaceId: ResourceIdSchema.optional(),
  actorId: ResourceIdSchema.optional(),
  resourceType: requiredLimitedString(64).optional(),
  resourceId: ResourceIdSchema.optional(),
  platform: DiagnosticsPlatformSchema,
  appVersion: requiredLimitedString(64).optional(),
  buildNumber: requiredLimitedString(64).optional(),
  route: requiredLimitedString(160).optional(),
  properties: EventMetadataSchema.default({})
})

export type ProductEvent = z.infer<typeof ProductEventSchema>

export const ProductEventBatchSchema = z.strictObject({
  events: z
    .array(ProductEventSchema)
    .min(1, "Product event batch must contain at least one event.")
    .max(50, "Product event batch cannot contain more than 50 events.")
})

export type ProductEventBatch = z.infer<typeof ProductEventBatchSchema>

export const AuditEventActionSchema = z.enum([
  "auth.sign_in",
  "auth.sign_out",
  "auth.failed",
  "invite.created",
  "invite.revoked",
  "lead.stage_changed",
  "lead.reviewed",
  "lead.score_overridden",
  "appointment.created",
  "appointment.updated",
  "appointment.status_changed",
  "settings.updated",
  "notification_preferences.updated",
  "privacy.export_requested",
  "privacy.delete_requested",
  "role.changed"
])

export type AuditEventAction = z.infer<typeof AuditEventActionSchema>

export const AuditActorTypeSchema = z.enum(["agent", "lead", "system", "public_intake"])
export type AuditActorType = z.infer<typeof AuditActorTypeSchema>

export const AuditEventSchema = z.strictObject({
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
  action: AuditEventActionSchema,
  actorId: ResourceIdSchema.optional(),
  actorType: AuditActorTypeSchema,
  agentId: ResourceIdSchema.optional(),
  workspaceId: ResourceIdSchema.optional(),
  resourceType: requiredLimitedString(64),
  resourceId: ResourceIdSchema.optional(),
  requestIp: requiredLimitedString(128).optional(),
  userAgent: requiredLimitedString(500).optional(),
  platform: DiagnosticsPlatformSchema.optional(),
  appVersion: requiredLimitedString(64).optional(),
  beforeSummary: EventMetadataSchema.default({}),
  afterSummary: EventMetadataSchema.default({}),
  metadata: EventMetadataSchema.default({})
})

export type AuditEvent = z.infer<typeof AuditEventSchema>

export const AuditEventBatchSchema = z.strictObject({
  events: z
    .array(AuditEventSchema)
    .min(1, "Audit event batch must contain at least one event.")
    .max(50, "Audit event batch cannot contain more than 50 events.")
})

export type AuditEventBatch = z.infer<typeof AuditEventBatchSchema>

export const ConsentSubjectTypeSchema = z.enum(["agent", "lead", "device", "workspace", "public_intake"])
export type ConsentSubjectType = z.infer<typeof ConsentSubjectTypeSchema>

export const ConsentTypeSchema = z.enum([
  "privacy_policy",
  "terms",
  "push_notifications",
  "email_notifications",
  "marketing_email",
  "data_export",
  "data_delete"
])

export type ConsentType = z.infer<typeof ConsentTypeSchema>

export const ConsentStatusSchema = z.enum([
  "granted",
  "denied",
  "withdrawn",
  "requested",
  "completed",
  "failed",
  "not_determined"
])

export type ConsentStatus = z.infer<typeof ConsentStatusSchema>

export const ConsentRecordSchema = z.strictObject({
  id: z.string().uuid(),
  subjectType: ConsentSubjectTypeSchema,
  subjectId: ResourceIdSchema.optional(),
  agentId: ResourceIdSchema.optional(),
  consentType: ConsentTypeSchema,
  status: ConsentStatusSchema,
  policyVersion: requiredLimitedString(64).optional(),
  source: requiredLimitedString(128).optional(),
  occurredAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  metadata: EventMetadataSchema.default({})
})

export type ConsentRecord = z.infer<typeof ConsentRecordSchema>

export const ConsentRecordBatchSchema = z.strictObject({
  records: z
    .array(ConsentRecordSchema)
    .min(1, "Consent record batch must contain at least one record.")
    .max(50, "Consent record batch cannot contain more than 50 records.")
})

export type ConsentRecordBatch = z.infer<typeof ConsentRecordBatchSchema>

export const FirstPartyEventBatchResponseSchema = z.object({
  acceptedCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  rejectedEventIds: z.array(z.string())
})

export type FirstPartyEventBatchResponse = z.infer<typeof FirstPartyEventBatchResponseSchema>

export * from "./admin-dashboard"
