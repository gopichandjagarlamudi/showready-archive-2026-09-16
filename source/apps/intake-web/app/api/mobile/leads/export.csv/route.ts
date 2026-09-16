import { randomUUID } from "node:crypto"
import { LeadExportQuerySchema } from "@showready/contracts"
import { ZodError } from "zod"
import { buildLeadExportCsv } from "@/lib/leads/export-csv"
import { MobileAuthError, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { getClientIp } from "@/lib/rate-limit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getAgentContext,
  listSubmittedLeadsForCsvExport,
  recordAuditEvents
} from "@/lib/supabase/data"

const MAX_EXPORT_DAYS = 366
const MAX_EXPORT_ROWS = 10_000

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map((entry) => Number.parseInt(entry, 10))

  return {
    year,
    month,
    day
  }
}

function dayNumber(value: string) {
  const { year, month, day } = parseDateOnly(value)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function getTimeZoneParts(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
  const parts = formatter.formatToParts(value)
  const partMap = new Map(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(partMap.get("year")),
    month: Number(partMap.get("month")),
    day: Number(partMap.get("day")),
    hour: Number(partMap.get("hour")),
    minute: Number(partMap.get("minute")),
    second: Number(partMap.get("second"))
  }
}

function localDateTimeToUtc(input: {
  date: string
  timeZone?: string
  hour: number
  minute: number
  second: number
  millisecond: number
}) {
  const { year, month, day } = parseDateOnly(input.date)
  const targetMs = Date.UTC(
    year,
    month - 1,
    day,
    input.hour,
    input.minute,
    input.second,
    input.millisecond
  )

  if (!input.timeZone) {
    return new Date(targetMs)
  }

  try {
    let utcMs = targetMs

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = getTimeZoneParts(new Date(utcMs), input.timeZone)
      const actualMs = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        input.millisecond
      )
      utcMs -= actualMs - targetMs
    }

    return new Date(utcMs)
  } catch {
    return new Date(targetMs)
  }
}

function rangeBounds(from: string, to: string, timeZone?: string) {
  return {
    submittedFrom: localDateTimeToUtc({
      date: from,
      timeZone,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    }).toISOString(),
    submittedTo: localDateTimeToUtc({
      date: to,
      timeZone,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999
    }).toISOString()
  }
}

function fileName(from: string, to: string) {
  return `showready-leads-${from}-to-${to}.csv`
}

function validationMessage(error: ZodError) {
  const issue = error.issues[0]

  if (issue?.path.includes("from") || issue?.path.includes("to")) {
    return "Export dates must use YYYY-MM-DD format."
  }

  return issue?.message ?? "Export dates must use YYYY-MM-DD format."
}

async function errorResponse(input: {
  request: Request
  error: unknown
  status: number
  agentId?: string
  message: string
}) {
  return requestErrorResponse({
    request: input.request,
    error: input.error,
    route: "api.mobile.leads.export",
    status: input.status,
    agentId: input.agentId,
    response: {
      error: input.message
    }
  })
}

export async function GET(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const { searchParams } = new URL(request.url)
    const query = LeadExportQuerySchema.parse(Object.fromEntries(searchParams.entries()))
    const fromDay = dayNumber(query.from)
    const toDay = dayNumber(query.to)

    if (fromDay > toDay) {
      return errorResponse({
        request,
        error: new Error("From date must be on or before to date."),
        status: 400,
        agentId,
        message: "From date must be on or before to date."
      })
    }

    if (toDay - fromDay + 1 > MAX_EXPORT_DAYS) {
      return errorResponse({
        request,
        error: new Error("Export date range is too large."),
        status: 400,
        agentId,
        message: "Export date range cannot exceed 366 days."
      })
    }

    const bounds = rangeBounds(query.from, query.to, query.timeZone)
    const [context, leads] = await Promise.all([
      getAgentContext(auth.client, agentId),
      listSubmittedLeadsForCsvExport(auth.client, agentId, {
        ...bounds,
        limit: MAX_EXPORT_ROWS
      })
    ])
    const csv = buildLeadExportCsv(leads, {
      agentFullName: context?.agent.fullName
    })
    const requestIp = getClientIp(request)
    const userAgent = request.headers.get("user-agent")?.trim() || undefined

    await recordAuditEvents(createSupabaseAdminClient(), agentId, [
      {
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        action: "privacy.export_requested",
        actorId: agentId,
        actorType: "agent",
        resourceType: "lead_export",
        requestIp,
        userAgent,
        beforeSummary: {},
        afterSummary: {},
        metadata: {
          from: query.from,
          to: query.to,
          timeZone: query.timeZone ?? "UTC",
          exportedLeadCount: leads.length
        }
      }
    ])

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${fileName(query.from, query.to)}"`,
        "x-lead-export-count": String(leads.length)
      }
    })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.leads.export",
        status: error.status,
        response: { error: error.message },
        headers: error.headers
      })
    }

    if (error instanceof ZodError) {
      return errorResponse({
        request,
        error,
        status: 400,
        agentId,
        message: validationMessage(error)
      })
    }

    if (error instanceof Error && error.message.startsWith("Export contains too many leads")) {
      return errorResponse({
        request,
        error,
        status: 413,
        agentId,
        message: error.message
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.leads.export",
      status: 500,
      agentId,
      response: { error: "Unable to export leads." }
    })
  }
}
