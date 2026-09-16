import {
  consumeRateLimit,
  getClientIp,
  getDefaultRateLimitStore,
  resetDefaultRateLimitStore
} from "./rate-limit"

export type PublicIntakeAction = "autosave" | "submit"

export type PublicIntakeGuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string; headers?: Record<string, string> }

const MAX_BODY_BYTES = 64 * 1024
const SUBMIT_MINIMUM_AGE_MS = 1500
const WINDOW_MS = 60_000

const actionLimits: Record<PublicIntakeAction, { token: number; ip: number }> = {
  autosave: {
    token: 90,
    ip: 240
  },
  submit: {
    token: 5,
    ip: 30
  }
}

function isJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type")

  return Boolean(contentType?.toLowerCase().startsWith("application/json"))
}

function getBodySize(request: Request) {
  const contentLength = request.headers.get("content-length")

  if (!contentLength) {
    return null
  }

  const parsed = Number.parseInt(contentLength, 10)

  return Number.isFinite(parsed) ? parsed : null
}

function reject(
  status: number,
  error: string,
  headers?: Record<string, string>
): PublicIntakeGuardResult {
  return {
    ok: false,
    status,
    error,
    headers
  }
}

export function resetPublicIntakeRateLimits() {
  resetDefaultRateLimitStore()
}

export async function guardPublicIntakeRequest(
  request: Request,
  token: string,
  action: PublicIntakeAction
): Promise<PublicIntakeGuardResult> {
  if (request.method !== "POST") {
    return reject(405, "Method not allowed.")
  }

  if (!isJsonRequest(request)) {
    return reject(415, "Public intake requests must be JSON.")
  }

  const bodySize = getBodySize(request)
  if (bodySize !== null && bodySize > MAX_BODY_BYTES) {
    return reject(413, "Public intake request is too large.")
  }

  const now = Date.now()
  const ip = getClientIp(request)
  const limits = actionLimits[action]
  const store = getDefaultRateLimitStore()
  const ipLimit = await consumeRateLimit(store, {
    key: `public-intake:${action}:ip:${ip}`,
    limit: limits.ip,
    windowMs: WINDOW_MS,
    now
  })

  if (!ipLimit.allowed) {
    return reject(
      429,
      "Too many intake requests. Please try again shortly.",
      ipLimit.headers
    )
  }

  const tokenLimit = await consumeRateLimit(store, {
    key: `public-intake:${action}:token:${token}`,
    limit: limits.token,
    windowMs: WINDOW_MS,
    now
  })

  if (!tokenLimit.allowed) {
    return reject(
      429,
      "Too many intake requests. Please try again shortly.",
      tokenLimit.headers
    )
  }

  return { ok: true }
}

export function assertPublicIntakePayloadAllowed(
  payload: unknown,
  action: PublicIntakeAction = "autosave"
) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Unable to save your progress right now.")
  }

  const guard = (payload as { guard?: unknown }).guard

  if (!guard || typeof guard !== "object") {
    return
  }

  const website = (guard as { website?: unknown }).website
  if (typeof website === "string" && website.trim().length > 0) {
    throw new Error("Unable to save your progress right now.")
  }

  const startedAt = (guard as { startedAt?: unknown }).startedAt
  if (
    action === "submit" &&
    typeof startedAt === "number" &&
    Number.isFinite(startedAt) &&
    Date.now() - startedAt < SUBMIT_MINIMUM_AGE_MS
  ) {
    throw new Error("Please try submitting again.")
  }
}
