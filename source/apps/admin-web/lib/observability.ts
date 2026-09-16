import { createSupabaseAdminClient } from "./supabase/admin"

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi

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

function sanitizeText(value: string, maxLength = 2000) {
  return limitString(
    value
      .replace(BEARER_PATTERN, "Bearer [redacted]")
      .replace(EMAIL_PATTERN, "[redacted-email]"),
    maxLength
  )
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
    if (error.name && error.name !== "Error") {
      return limitString(error.name, 120)
    }

    const constructorName = error.constructor?.name
    return limitString(constructorName && constructorName !== "Error" ? constructorName : "Error", 120)
  }

  return typeof error
}

type AdminErrorContext = {
  route: string
  method: string
  path: string
}

export function createAdminServerErrorRow(error: unknown, context: AdminErrorContext) {
  const requestUrl = (() => {
    try {
      return new URL(context.path, "http://showready.local")
    } catch {
      return new URL("/", "http://showready.local")
    }
  })()

  return {
    id: createUuid(),
    agent_id: null,
    request_id: `req-${createUuid()}`,
    route: limitString(context.route, 160),
    method: limitString(context.method, 16),
    path: limitString(requestUrl.pathname, 240),
    error_type: getErrorType(error),
    message: sanitizeText(getErrorMessage(error)),
    stack: getErrorStack(error),
    query_keys: [] as string[],
    context: { app: "admin-web" },
    occurred_at: new Date().toISOString()
  }
}

export async function captureAdminServerError(error: unknown, context: AdminErrorContext) {
  const row = createAdminServerErrorRow(error, context)

  console.error(`[showready:${row.route}]`, {
    requestId: row.request_id,
    method: row.method,
    path: row.path,
    errorType: row.error_type,
    message: row.message
  })

  try {
    const { error: insertError } = await createSupabaseAdminClient()
      .from("server_error_events")
      .insert(row)

    if (insertError) {
      console.error("[showready:observability]", {
        requestId: row.request_id,
        message: "Unable to store admin server error event.",
        error: sanitizeText(getErrorMessage(insertError))
      })
    }
  } catch (loggingError) {
    console.error("[showready:observability]", {
      requestId: row.request_id,
      message: "Unable to store admin server error event.",
      error: sanitizeText(getErrorMessage(loggingError))
    })
  }
}
