import { z } from "zod"

const IsoDateTimeSchema = z.string().datetime({ offset: true })
const NullableIsoDateTimeSchema = IsoDateTimeSchema.nullable()
const UuidSchema = z.string().uuid()

export const AdminDashboardRangeDaysSchema = z.union([z.literal(7), z.literal(30), z.literal(90)])
export type AdminDashboardRangeDays = z.infer<typeof AdminDashboardRangeDaysSchema>

export const AdminCursorPayloadSchema = z.strictObject({
  offset: z.number().int().min(0).max(5000)
})
export type AdminCursorPayload = z.infer<typeof AdminCursorPayloadSchema>

export const AdminPageSizeSchema = z.union([z.literal(25), z.literal(50)])

const AdminListQueryShape = {
  query: z.string().trim().max(100).default(""),
  rangeDays: AdminDashboardRangeDaysSchema.default(30),
  offset: z.number().int().min(0).max(5000).default(0),
  pageSize: AdminPageSizeSchema.default(25)
}

export const AdminAgentListQuerySchema = z.strictObject(AdminListQueryShape)
export const AdminFeedbackListQuerySchema = z.strictObject(AdminListQueryShape)
export type AdminAgentListQuery = z.infer<typeof AdminAgentListQuerySchema>
export type AdminFeedbackListQuery = z.infer<typeof AdminFeedbackListQuerySchema>

export const AdminMetricSchema = z.strictObject({
  label: z.string().min(1).max(80),
  value: z.number().int().nonnegative(),
  helpText: z.string().min(1).max(160)
})

export const AdminDailyEventVolumeSchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().nonnegative()
})

export const AdminErrorGroupSchema = z.strictObject({
  source: z.enum(["diagnostic", "server"]),
  label: z.string().min(1).max(256),
  count: z.number().int().positive()
})

export const AdminDashboardOverviewSchema = z.strictObject({
  rangeDays: AdminDashboardRangeDaysSchema,
  metrics: z.array(AdminMetricSchema).length(8),
  dailyEventVolume: z.array(AdminDailyEventVolumeSchema),
  errorGroups: z.array(AdminErrorGroupSchema).max(5)
})
export type AdminDashboardOverview = z.infer<typeof AdminDashboardOverviewSchema>

export const AdminAgentListItemSchema = z.strictObject({
  id: UuidSchema,
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  brokerage: z.string().max(200).nullable(),
  joinedAt: NullableIsoDateTimeSchema,
  lastTrackedActivityAt: NullableIsoDateTimeSchema,
  leadCount: z.number().int().nonnegative(),
  submittedIntakeCount: z.number().int().nonnegative(),
  appointmentCount: z.number().int().nonnegative()
})

export const AdminAgentListSchema = z.strictObject({
  items: z.array(AdminAgentListItemSchema),
  total: z.number().int().nonnegative()
})
export type AdminAgentList = z.infer<typeof AdminAgentListSchema>

export const AdminFeedbackItemSchema = z.strictObject({
  id: UuidSchema,
  agentId: UuidSchema,
  agentFullName: z.string().min(1).max(200),
  agentEmail: z.string().email(),
  source: z.string().min(1).max(80),
  message: z.string().min(1).max(4000),
  createdAt: IsoDateTimeSchema
})

export const AdminFeedbackListSchema = z.strictObject({
  items: z.array(AdminFeedbackItemSchema),
  total: z.number().int().nonnegative()
})
export type AdminFeedbackList = z.infer<typeof AdminFeedbackListSchema>

export const AdminAgentDetailSchema = z.strictObject({
  profile: z.strictObject({
    id: UuidSchema,
    fullName: z.string().min(1).max(200),
    email: z.string().email(),
    brokerage: z.string().max(200).nullable(),
    joinedAt: NullableIsoDateTimeSchema,
    lastTrackedActivityAt: NullableIsoDateTimeSchema
  }),
  aggregates: z.strictObject({
    leadCount: z.number().int().nonnegative(),
    submittedIntakeCount: z.number().int().nonnegative(),
    appointmentCount: z.number().int().nonnegative()
  }),
  recentEvents: z.array(z.strictObject({
    eventName: z.string().min(1).max(80),
    occurredAt: IsoDateTimeSchema,
    platform: z.string().min(1).max(32).nullable(),
    appVersion: z.string().max(64).nullable(),
    route: z.string().max(160).nullable()
  })).max(20),
  feedback: z.array(z.strictObject({
    id: UuidSchema,
    source: z.string().min(1).max(80),
    message: z.string().min(1).max(4000),
    createdAt: IsoDateTimeSchema
  })).max(20),
  diagnostics: z.array(z.strictObject({
    id: UuidSchema,
    severity: z.enum(["debug", "info", "warning", "error", "fatal"]),
    message: z.string().min(1).max(2000),
    fingerprint: z.string().max(256).nullable(),
    screen: z.string().max(160).nullable(),
    requestPath: z.string().max(160).nullable(),
    appVersion: z.string().max(64).nullable(),
    occurredAt: IsoDateTimeSchema
  })).max(20),
  serverErrors: z.array(z.strictObject({
    id: UuidSchema,
    errorType: z.string().min(1).max(120),
    message: z.string().min(1).max(2000),
    route: z.string().min(1).max(160),
    path: z.string().min(1).max(240),
    status: z.number().int().min(0).max(599),
    occurredAt: IsoDateTimeSchema
  })).max(20)
})
export type AdminAgentDetail = z.infer<typeof AdminAgentDetailSchema>
