import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "./supabase/admin"

type ServerErrorMetadataValue =
  | string
  | number
  | boolean
  | null
  | ServerErrorMetadataValue[]
  | { [key: string]: ServerErrorMetadataValue }

type ServerErrorMetadata = Record<string, ServerErrorMetadataValue>

type CaptureRequestErrorInput = {
  request: Request
  error: unknown
  route: string
  status: number
  agentId?: string
  context?: Record<string, unknown>
}

type CaptureClientErrorInput = {
  request: Request
  error: unknown
  route: string
  path: string
  context?: Record<string, unknown>
}

type NextRequestErrorContext = {
  routerKind?: string
  routePath?: string
  routeType?: string
  renderSource?: string
  revalidateReason?: string
}

type CaptureNextRequestErrorInput = {
  path: string
  method: string
  headers: Record<string, string | string[] | undefined>
  context: NextRequestErrorContext
}

type RequestErrorResponseInput = CaptureRequestErrorInput & {
  response: Record<string, unknown>
  headers?: HeadersInit
}

const SENSITIVE_CONTEXT_KEYS = [
  "authorization",
  "cookie",
  "email",
  "phone",
  "address",
  "note",
  "notes",
  "token",
  "password",
  "secret",
  "header",
  "headers",
  "body",
  "payload",
  "request",
  "response"
]
const UUID_SEGMENT_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const SECRET_ASSIGNMENT_PATTERN = /\b(token|secret|password)(\s*[:=]\s*|\s+)[^\s,;]+/gi
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g

function createUuid() {
  const randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
  if (randomUuid) {
    return randomUuid()
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (entry) => {
    const value = Math.floor(Math.random() * 16)
    return (entry === "x" ? value : (value & 0x3) | 0x8).toString(16)
  })
}

function limitString(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

function isSensitiveContextKey(key: string) {
  const normalizedKey = key.toLowerCase()
  return SENSITIVE_CONTEXT_KEYS.some((entry) => normalizedKey.includes(entry))
}

function sanitizeText(value: string, maxLength = 2000) {
  return limitString(
    value
      .replace(BEARER_PATTERN, "Bearer [redacted]")
      .replace(EMAIL_PATTERN, "[redacted-email]")
      .replace(SECRET_ASSIGNMENT_PATTERN, "$1$2[redacted]")
      .replace(PHONE_PATTERN, "[redacted-phone]"),
    maxLength
  )
}

function sanitizeMetadataValue(value: unknown): ServerErrorMetadataValue | undefined {
  if (value === null) {
    return null
  }

  if (typeof value === "string") {
    return sanitizeText(value)
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((entry) => sanitizeMetadataValue(entry))
      .filter((entry): entry is ServerErrorMetadataValue => entry !== undefined)
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce<ServerErrorMetadata>((result, [key, entryValue]) => {
      if (isSensitiveContextKey(key)) {
        return result
      }

      const sanitizedValue = sanitizeMetadataValue(entryValue)
      if (sanitizedValue !== undefined) {
        result[key] = sanitizedValue
      }

      return result
    }, {})
  }

  return undefined
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): ServerErrorMetadata {
  if (!metadata) {
    return {}
  }

  const sanitizedValue = sanitizeMetadataValue(metadata)

  if (!sanitizedValue || Array.isArray(sanitizedValue) || typeof sanitizedValue !== "object") {
    return {}
  }

  return sanitizedValue
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || "Unknown backend error."
  }

  return typeof error === "string" ? error : "Unknown backend error."
}

function getErrorStack(error: unknown) {
  if (error instanceof Error && error.stack) {
    return sanitizeText(error.stack, 8000)
  }

  return null
}

function getErrorType(error: unknown) {
  if (error instanceof Error) {
    const constructorName = error.constructor?.name
    if (error.name && error.name !== "Error") {
      return limitString(error.name, 120)
    }

    return limitString(constructorName && constructorName !== "Error" ? constructorName : "Error", 120)
  }

  return typeof error
}

function getRequestId(request: Request) {
  const existingRequestId = request.headers.get("x-request-id")?.trim()
  return existingRequestId || `req-${createUuid()}`
}

function getRequestIdFromHeaderRecord(headers: Record<string, string | string[] | undefined>) {
  const existingRequestId = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === "x-request-id"
  )?.[1]
  const requestId = Array.isArray(existingRequestId) ? existingRequestId[0] : existingRequestId

  return requestId?.trim() || `req-${createUuid()}`
}

function getQueryKeys(requestUrl: URL) {
  return Array.from(new Set(requestUrl.searchParams.keys())).sort()
}

function normalizePath(pathname: string) {
  return pathname
    .replace(/\/intake\/[^/]+\/complete$/, "/intake/:token/complete")
    .replace(/\/intake\/[^/]+$/, "/intake/:token")
    .replace(/\/api\/intake\/[^/]+\/autosave$/, "/api/intake/:token/autosave")
    .replace(/\/api\/intake\/[^/]+\/submit$/, "/api/intake/:token/submit")
    .replace(
      /\/api\/mobile\/leads\/[^/]+\/contact-interactions$/,
      "/api/mobile/leads/:leadId/contact-interactions"
    )
    .replace(/\/api\/mobile\/leads\/[^/]+\/override-score$/, "/api/mobile/leads/:leadId/override-score")
    .replace(/\/api\/mobile\/leads\/[^/]+\/stage$/, "/api/mobile/leads/:leadId/stage")
    .replace(/\/api\/mobile\/leads\/[^/]+$/, "/api/mobile/leads/:leadId")
    .replace(
      /\/api\/mobile\/appointments\/[^/]+\/status$/,
      "/api/mobile/appointments/:appointmentId/status"
    )
    .replace(UUID_SEGMENT_PATTERN, ":id")
}

function parsePath(path: string) {
  try {
    return new URL(path, "http://showready.local")
  } catch {
    return new URL("/", "http://showready.local")
  }
}

function createServerErrorRow(input: {
  requestId: string
  route: string
  method: string
  path: string
  status: number
  error: unknown
  agentId?: string
  context?: Record<string, unknown>
}) {
  const requestUrl = parsePath(input.path)

  return {
    id: createUuid(),
    agent_id: input.agentId ?? null,
    request_id: input.requestId,
    route: limitString(input.route, 160),
    method: limitString(input.method, 16),
    path: limitString(normalizePath(requestUrl.pathname), 240),
    status: input.status,
    error_type: getErrorType(input.error),
    message: sanitizeText(getErrorMessage(input.error)),
    stack: getErrorStack(input.error),
    query_keys: getQueryKeys(requestUrl),
    context: sanitizeMetadata(input.context),
    occurred_at: new Date().toISOString()
  }
}

async function storeServerErrorRow(row: ReturnType<typeof createServerErrorRow>) {
  console.error(`[showready:${row.route}]`, {
    requestId: row.request_id,
    status: row.status,
    method: row.method,
    path: row.path,
    errorType: row.error_type,
    message: row.message
  })

  try {
    const { error } = await createSupabaseAdminClient().from("server_error_events").insert(row)

    if (error) {
      console.error("[showready:observability]", {
        requestId: row.request_id,
        message: "Unable to store server error event.",
        error: sanitizeText(getErrorMessage(error))
      })
    }
  } catch (loggingError) {
    console.error("[showready:observability]", {
      requestId: row.request_id,
      message: "Unable to store server error event.",
      error: sanitizeText(getErrorMessage(loggingError))
    })
  }

  return { requestId: row.request_id }
}

export function captureServerError(error: unknown, context: string) {
  console.error(`[showready:${limitString(context, 160)}]`, {
    errorType: getErrorType(error),
    message: sanitizeText(getErrorMessage(error))
  })
}

export async function captureRequestError(input: CaptureRequestErrorInput) {
  const requestId = getRequestId(input.request)
  const row = createServerErrorRow({
    requestId,
    route: input.route,
    method: input.request.method,
    path: input.request.url,
    status: input.status,
    error: input.error,
    agentId: input.agentId,
    context: input.context
  })

  return storeServerErrorRow(row)
}

export async function captureClientError(input: CaptureClientErrorInput) {
  const requestId = getRequestId(input.request)
  const row = createServerErrorRow({
    requestId,
    route: input.route,
    method: "CLIENT",
    path: input.path,
    status: 0,
    error: input.error,
    context: input.context
  })

  return storeServerErrorRow(row)
}

export async function captureNextRequestError(error: unknown, input: CaptureNextRequestErrorInput) {
  const requestId = getRequestIdFromHeaderRecord(input.headers)
  const routeType = input.context.routeType || "request"
  const routePath = input.context.routePath || "unknown"
  const row = createServerErrorRow({
    requestId,
    route: `next.${routeType}.${routePath}`,
    method: input.method,
    path: input.path,
    status: 500,
    error,
    context: input.context
  })

  return storeServerErrorRow(row)
}

export async function requestErrorResponse(input: RequestErrorResponseInput) {
  const { requestId } = await captureRequestError(input)
  const headers = new Headers(input.headers)
  headers.set("x-request-id", requestId)

  return NextResponse.json(input.response, {
    status: input.status,
    headers
  })
}
