type ServerErrorMetadataValue =
  | string
  | number
  | boolean
  | null
  | ServerErrorMetadataValue[]
  | { [key: string]: ServerErrorMetadataValue }

type ServerErrorMetadata = Record<string, ServerErrorMetadataValue>

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

export async function captureNextRequestError(error: unknown, input: CaptureNextRequestErrorInput) {
  const requestId = getRequestIdFromHeaderRecord(input.headers)
  const routeType = input.context.routeType || "request"
  const routePath = input.context.routePath || "unknown"
  const requestUrl = parsePath(input.path)
  const route = `next.${routeType}.${routePath}`

  console.error(`[showready:${route}]`, {
    requestId,
    status: 500,
    method: limitString(input.method, 16),
    path: limitString(normalizePath(requestUrl.pathname), 240),
    errorType: getErrorType(error),
    message: sanitizeText(getErrorMessage(error)),
    queryKeys: getQueryKeys(requestUrl),
    context: sanitizeMetadata(input.context)
  })

  return { requestId }
}
