import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient } from "./supabase/admin"

export type RateLimitHeaders = Record<string, string>

export type RateLimitInput = {
  key: string
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds: number
  headers: RateLimitHeaders
}

export type RateLimitBatchResult = RateLimitResult & {
  key: string
}

export type RateLimitStore = {
  consume(input: RateLimitInput & { now: number }): Promise<Pick<RateLimitResult, "allowed" | "remaining" | "resetAt">>
  consumeMany?(input: {
    limits: RateLimitInput[]
    now: number
  }): Promise<Array<Pick<RateLimitBatchResult, "key" | "allowed" | "remaining" | "resetAt">>>
  reset?: () => void
}

type MemoryRateEntry = {
  count: number
  resetAt: number
}

const fallbackMemoryRateLimitStore = createMemoryRateLimitStore()
let defaultRateLimitStore: RateLimitStore | null = null

export function createMemoryRateLimitStore(): RateLimitStore {
  const entries = new Map<string, MemoryRateEntry>()

  function consumeEntry({ key, limit, windowMs, now }: RateLimitInput & { now: number }) {
    const existing = entries.get(key)

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs
      entries.set(key, {
        count: 1,
        resetAt
      })
      return {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        resetAt
      }
    }

    existing.count += 1

    return {
      allowed: existing.count <= limit,
      remaining: Math.max(limit - existing.count, 0),
      resetAt: existing.resetAt
    }
  }

  return {
    async consume(input) {
      return consumeEntry(input)
    },
    async consumeMany({ limits, now }) {
      return limits.map((input) => ({
        key: input.key,
        ...consumeEntry({ ...input, now })
      }))
    },
    reset() {
      entries.clear()
    }
  }
}

export function createSupabaseRateLimitStore(client: SupabaseClient<any>): RateLimitStore {
  async function consumeOne({ key, limit, windowMs, now }: RateLimitInput & { now: number }) {
    const { data, error } = await client.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
      p_now: new Date(now).toISOString()
    })

    if (error) {
      throw error
    }

    const row = Array.isArray(data) ? data[0] : data
    const resetAt = new Date(row.reset_at).getTime()

    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining ?? 0),
      resetAt
    }
  }

  return {
    async consume(input) {
      return consumeOne(input)
    },
    async consumeMany({ limits, now }) {
      const { data, error } = await client.rpc("consume_rate_limits", {
        p_limits: limits.map((limit) => ({
          key: limit.key,
          limit: limit.limit,
          windowMs: limit.windowMs
        })),
        p_now: new Date(now).toISOString()
      })

      if (error) {
        if (isMissingBatchRateLimitRpc(error)) {
          return Promise.all(
            limits.map(async (limit) => ({
              key: limit.key,
              ...(await consumeOne({ ...limit, now }))
            }))
          )
        }

        throw error
      }

      return (data ?? []).map((row: any) => ({
        key: row.key,
        allowed: Boolean(row.allowed),
        remaining: Number(row.remaining ?? 0),
        resetAt: new Date(row.reset_at).getTime()
      }))
    }
  }
}

function isMissingBatchRateLimitRpc(error: unknown) {
  const candidate = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }
  const message = [
    candidate.message,
    candidate.details,
    candidate.hint
  ]
    .filter(Boolean)
    .join(" ")

  return (
    (candidate.code === "PGRST202" || candidate.code === "42883") &&
    message.includes("consume_rate_limits")
  )
}

function shouldUseSupabaseRateLimitStore() {
  if (process.env.RATE_LIMIT_STORE === "memory") {
    return false
  }

  return process.env.RATE_LIMIT_STORE === "supabase" || process.env.NODE_ENV === "production"
}

export function getDefaultRateLimitStore() {
  if (!defaultRateLimitStore) {
    defaultRateLimitStore = shouldUseSupabaseRateLimitStore()
      ? createSupabaseRateLimitStore(createSupabaseAdminClient())
      : fallbackMemoryRateLimitStore
  }

  return defaultRateLimitStore
}

export function resetRateLimitStore(store: RateLimitStore = getDefaultRateLimitStore()) {
  store.reset?.()
}

export function resetDefaultRateLimitStore() {
  resetRateLimitStore(fallbackMemoryRateLimitStore)
  defaultRateLimitStore = null
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()

  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown"
}

function buildHeaders(input: {
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}) {
  return {
    "Retry-After": String(input.retryAfterSeconds),
    "X-RateLimit-Limit": String(input.limit),
    "X-RateLimit-Remaining": String(input.remaining),
    "X-RateLimit-Reset": String(Math.ceil(input.resetAt / 1000))
  }
}

export async function consumeRateLimit(
  store: RateLimitStore,
  input: {
    key: string
    limit: number
    windowMs: number
    now?: number
  }
): Promise<RateLimitResult> {
  const now = input.now ?? Date.now()
  const result = await store.consume({
    key: input.key,
    limit: input.limit,
    windowMs: input.windowMs,
    now
  })
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000))

  return {
    ...result,
    retryAfterSeconds,
    headers: buildHeaders({
      limit: input.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
      retryAfterSeconds
    })
  }
}

export async function consumeRateLimits(
  store: RateLimitStore,
  input: {
    limits: RateLimitInput[]
    now?: number
  }
): Promise<RateLimitBatchResult[]> {
  const now = input.now ?? Date.now()
  const results = store.consumeMany
    ? await store.consumeMany({
        limits: input.limits,
        now
      })
    : await Promise.all(
        input.limits.map(async (limit) => ({
          key: limit.key,
          ...(await store.consume({
            ...limit,
            now
          }))
        }))
      )

  return results.map((result, index) => {
    const limit = input.limits.find((entry) => entry.key === result.key) ?? input.limits[index]
    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000))

    return {
      ...result,
      retryAfterSeconds,
      headers: buildHeaders({
        limit: limit?.limit ?? 1,
        remaining: result.remaining,
        resetAt: result.resetAt,
        retryAfterSeconds
      })
    }
  })
}
