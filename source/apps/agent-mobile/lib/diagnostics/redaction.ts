import type { DiagnosticsMetadata, DiagnosticsMetadataValue } from "@showready/contracts"

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

export function sanitizeDiagnosticsText(value: string, maxLength = 2000) {
  return limitString(
    value
      .replace(BEARER_PATTERN, "Bearer [redacted]")
      .replace(EMAIL_PATTERN, "[redacted-email]")
      .replace(SECRET_ASSIGNMENT_PATTERN, "$1$2[redacted]")
      .replace(PHONE_PATTERN, "[redacted-phone]"),
    maxLength
  )
}

export function sanitizeDiagnosticsPath(path: string, maxLength = 160) {
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
    return value
      .map((entry) => sanitizeDiagnosticsValue(entry, key))
      .filter((entry): entry is DiagnosticsMetadataValue => entry !== undefined)
  }

  return Object.entries(value).reduce<DiagnosticsMetadata>((result, [key, entryValue]) => {
    if (isBlockedContextKey(key)) {
      return result
    }

    const sanitizedValue = sanitizeDiagnosticsValue(entryValue, key)

    if (sanitizedValue !== undefined) {
      result[key] = sanitizedValue
    }

    return result
  }, {})
}

export function sanitizeDiagnosticsMetadata(metadata: DiagnosticsMetadata | undefined): DiagnosticsMetadata {
  if (!metadata) {
    return {}
  }

  const sanitizedValue = sanitizeDiagnosticsValue(metadata)

  if (!sanitizedValue || Array.isArray(sanitizedValue) || typeof sanitizedValue !== "object") {
    return {}
  }

  return sanitizedValue
}
