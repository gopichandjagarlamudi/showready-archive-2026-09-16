import { createClient, type User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import {
  consumeRateLimits,
  getClientIp,
  getDefaultRateLimitStore,
  resetDefaultRateLimitStore,
  type RateLimitHeaders
} from "./rate-limit"
import { createSupabaseAdminClient } from "./supabase/admin"
import { getSupabaseAnonKey, getSupabaseUrl } from "./supabase/env"
import { ensureAgentScaffold } from "./supabase/data"

export class MobileAuthError extends Error {
  status: number
  headers?: RateLimitHeaders

  constructor(status: number, message: string, headers?: RateLimitHeaders) {
    super(message)
    this.status = status
    this.headers = headers
  }
}

const WINDOW_MS = 60_000
const DEFAULT_PRE_AUTH_LIMIT = 120
const DEFAULT_USER_LIMIT = 120
const AGENT_SCAFFOLD_CACHE_MS = 5 * 60_000
const scaffoldedAgentCache = new Map<string, number>()

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name]
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeMobilePath(pathname: string) {
  return pathname
    .replace(/\/api\/mobile\/leads\/[^/]+\/override-score$/, "/api/mobile/leads/:leadId/override-score")
    .replace(/\/api\/mobile\/leads\/[^/]+\/stage$/, "/api/mobile/leads/:leadId/stage")
    .replace(/\/api\/mobile\/leads\/[^/]+$/, "/api/mobile/leads/:leadId")
    .replace(
      /\/api\/mobile\/appointments\/[^/]+\/status$/,
      "/api/mobile/appointments/:appointmentId/status"
    )
}

function getRouteKey(request: Request) {
  const url = new URL(request.url)
  return `${request.method}:${normalizeMobilePath(url.pathname)}`
}

function getUserLimit(request: Request) {
  const routeKey = getRouteKey(request)

  if (routeKey === "POST:/api/mobile/invites") {
    return readPositiveIntegerEnv("MOBILE_RATE_LIMIT_INVITES_PER_MINUTE", 10)
  }

  if (routeKey === "POST:/api/mobile/diagnostics") {
    return readPositiveIntegerEnv("MOBILE_RATE_LIMIT_DIAGNOSTICS_PER_MINUTE", 30)
  }

  return readPositiveIntegerEnv("MOBILE_RATE_LIMIT_USER_PER_MINUTE", DEFAULT_USER_LIMIT)
}

async function enforcePreAuthRateLimit(request: Request) {
  const now = Date.now()
  const ip = getClientIp(request)
  const routeKey = getRouteKey(request)
  const limit = readPositiveIntegerEnv(
    "MOBILE_RATE_LIMIT_PRE_AUTH_PER_MINUTE",
    DEFAULT_PRE_AUTH_LIMIT
  )

  const results = await consumeRateLimits(getDefaultRateLimitStore(), {
    limits: [
      {
        key: `mobile:pre-auth:route:${routeKey}:ip:${ip}`,
        limit,
        windowMs: WINDOW_MS
      }
    ],
    now
  })

  throwIfRateLimited(results)
}

async function enforceAuthenticatedRateLimit(request: Request, userId: string) {
  const now = Date.now()
  const ip = getClientIp(request)
  const routeKey = getRouteKey(request)
  const limit = getUserLimit(request)

  const results = await consumeRateLimits(getDefaultRateLimitStore(), {
    limits: [
      {
        key: `mobile:auth:user:${userId}:route:${routeKey}`,
        limit,
        windowMs: WINDOW_MS
      },
      {
        key: `mobile:auth:ip:${ip}:route:${routeKey}`,
        limit,
        windowMs: WINDOW_MS
      }
    ],
    now
  })

  throwIfRateLimited(results)
}

function throwIfRateLimited(
  results: Array<{ allowed: boolean; headers: RateLimitHeaders }>
) {
  const blocked = results.find((result) => !result.allowed)

  if (!blocked) {
    return
  }

  throw new MobileAuthError(
    429,
    "Too many mobile API requests. Please try again shortly.",
    blocked.headers
  )
}

async function ensureAgentScaffoldCached(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  user: User
) {
  const cachedUntil = scaffoldedAgentCache.get(user.id) ?? 0
  const now = Date.now()

  if (cachedUntil > now) {
    return
  }

  await ensureAgentScaffold(admin, user)
  scaffoldedAgentCache.set(user.id, now + AGENT_SCAFFOLD_CACHE_MS)
}

export function resetMobileRateLimits() {
  resetDefaultRateLimitStore()
  scaffoldedAgentCache.clear()
}

export function mobileErrorResponse(error: MobileAuthError) {
  return NextResponse.json(
    { error: error.message },
    { status: error.status, headers: error.headers }
  )
}

export async function requireMobileAgent(request: Request) {
  await enforcePreAuthRateLimit(request)

  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    throw new MobileAuthError(401, "Missing bearer token.")
  }

  const token = authorization.slice("Bearer ".length)
  const admin = createSupabaseAdminClient()
  const {
    data: { user },
    error
  } = await admin.auth.getUser(token)

  if (error || !user) {
    throw new MobileAuthError(401, "Invalid access token.")
  }

  await enforceAuthenticatedRateLimit(request, user.id)
  await ensureAgentScaffoldCached(admin, user)

  const client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return {
    agentId: user.id,
    client,
    user
  }
}
