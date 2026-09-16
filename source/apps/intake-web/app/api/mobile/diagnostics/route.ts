import { NextResponse } from "next/server"
import {
  DiagnosticsBatchResponseSchema,
  DiagnosticsBatchSchema,
  type DiagnosticsBreadcrumb,
  type DiagnosticsEvent,
  type DiagnosticsMetadata,
  type DiagnosticsMetadataValue
} from "@showready/contracts"
import { ZodError } from "zod"
import { MobileAuthError, mobileErrorResponse, requireMobileAgent } from "@/lib/mobile-auth"
import { requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { recordDiagnosticEvents } from "@/lib/supabase/data"

const BLOCKED_CONTEXT_KEYS = [
  "email",
  "phone",
  "address",
  "note",
  "notes",
  "token",
  "password",
  "header",
  "headers",
  "body",
  "response"
]
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const SECRET_ASSIGNMENT_PATTERN = /\b(token|secret|password)(\s*[:=]\s*|\s+)[^\s,;&]+/gi
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g

function limitString(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

function isBlockedContextKey(key: string) {
  const normalizedKey = key.toLowerCase()
  return BLOCKED_CONTEXT_KEYS.some((entry) => normalizedKey.includes(entry))
}

function isPathLikeContextKey(key: string) {
  const normalizedKey = key.toLowerCase()
  return normalizedKey.includes("path") || normalizedKey.includes("url")
}

function sanitizeDiagnosticsText(value: string, maxLength = 2000) {
  return limitString(
    value
      .replace(BEARER_PATTERN, "Bearer [redacted]")
      .replace(EMAIL_PATTERN, "[redacted-email]")
      .replace(SECRET_ASSIGNMENT_PATTERN, "$1$2[redacted]")
      .replace(PHONE_PATTERN, "[redacted-phone]"),
    maxLength
  )
}

function sanitizeDiagnosticsPath(path: string, maxLength = 160) {
  try {
    const url = new URL(path, "showready://mobile")
    const pathname = sanitizeDiagnosticsText(url.pathname, maxLength)
    const queryKeys = Array.from(new Set(url.searchParams.keys())).sort()
    const normalizedPath = queryKeys.length > 0 ? `${pathname}?${queryKeys.join("&")}` : pathname

    return limitString(normalizedPath, maxLength)
  } catch {
    return sanitizeDiagnosticsText(path, maxLength)
  }
}

function sanitizeDiagnosticsValue(
  value: DiagnosticsMetadataValue,
  key?: string
): DiagnosticsMetadataValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "string") {
      return key && isPathLikeContextKey(key)
        ? sanitizeDiagnosticsPath(value, 2000)
        : sanitizeDiagnosticsText(value)
    }

    return value
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeDiagnosticsValue(item, key))
      .filter((item): item is DiagnosticsMetadataValue => item !== undefined)

    return sanitizedItems
  }

  const sanitizedEntries = Object.entries(value).reduce<DiagnosticsMetadata>((result, [key, entryValue]) => {
    if (isBlockedContextKey(key)) {
      return result
    }

    const sanitizedValue = sanitizeDiagnosticsValue(entryValue, key)

    if (sanitizedValue !== undefined) {
      result[key] = sanitizedValue
    }

    return result
  }, {})

  return sanitizedEntries
}

function sanitizeDiagnosticsMetadata(metadata: DiagnosticsMetadata | undefined) {
  if (!metadata) {
    return {}
  }

  const sanitizedValue = sanitizeDiagnosticsValue(metadata)

  if (!sanitizedValue || Array.isArray(sanitizedValue) || typeof sanitizedValue !== "object") {
    return {}
  }

  return sanitizedValue
}

function sanitizeBreadcrumb(breadcrumb: DiagnosticsBreadcrumb): DiagnosticsBreadcrumb {
  return {
    ...breadcrumb,
    message: sanitizeDiagnosticsText(breadcrumb.message, 500),
    data: sanitizeDiagnosticsMetadata(breadcrumb.data)
  }
}

function sanitizeDiagnosticsEvent(event: DiagnosticsEvent): DiagnosticsEvent {
  return {
    ...event,
    message: sanitizeDiagnosticsText(event.message),
    fingerprint: event.fingerprint ? sanitizeDiagnosticsText(event.fingerprint, 256) : undefined,
    screen: event.screen ? sanitizeDiagnosticsPath(event.screen) : undefined,
    requestPath: event.requestPath ? sanitizeDiagnosticsPath(event.requestPath) : undefined,
    context: sanitizeDiagnosticsMetadata(event.context),
    breadcrumbs: event.breadcrumbs.map((breadcrumb) => sanitizeBreadcrumb(breadcrumb)),
    tags: sanitizeDiagnosticsMetadata(event.tags)
  }
}

function getValidationErrorMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid diagnostics payload."
}

export async function POST(request: Request) {
  let agentId: string | undefined

  try {
    const auth = await requireMobileAgent(request)
    agentId = auth.agentId
    const payload = DiagnosticsBatchSchema.parse(await request.json())
    const sanitizedEvents = payload.events.map((event) => sanitizeDiagnosticsEvent(event))
    const result = await recordDiagnosticEvents(createSupabaseAdminClient(), agentId, sanitizedEvents)

    return NextResponse.json(DiagnosticsBatchResponseSchema.parse(result), {
      status: 202
    })
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return mobileErrorResponse(error)
    }

    if (error instanceof ZodError) {
      return requestErrorResponse({
        request,
        error,
        route: "api.mobile.diagnostics",
        status: 400,
        agentId,
        response: { error: getValidationErrorMessage(error) }
      })
    }

    return requestErrorResponse({
      request,
      error,
      route: "api.mobile.diagnostics",
      status: 400,
      agentId,
      response: { error: "Unable to record diagnostics." }
    })
  }
}
