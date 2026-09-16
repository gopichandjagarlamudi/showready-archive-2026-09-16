import { describe, expect, it, vi } from "vitest"
import {
  createMemoryRateLimitStore,
  createSupabaseRateLimitStore,
  consumeRateLimits,
  consumeRateLimit,
  getClientIp,
  resetRateLimitStore
} from "./rate-limit"

describe("rate limit utilities", () => {
  it("blocks requests after the fixed window limit and reports retry timing", async () => {
    const store = createMemoryRateLimitStore()
    const first = await consumeRateLimit(store, {
      key: "api:user:agent-1",
      limit: 2,
      windowMs: 60_000,
      now: 1_000
    })
    const second = await consumeRateLimit(store, {
      key: "api:user:agent-1",
      limit: 2,
      windowMs: 60_000,
      now: 2_000
    })
    const blocked = await consumeRateLimit(store, {
      key: "api:user:agent-1",
      limit: 2,
      windowMs: 60_000,
      now: 3_000
    })

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(blocked).toMatchObject({
      allowed: false,
      retryAfterSeconds: 58,
      headers: {
        "Retry-After": "58",
        "X-RateLimit-Limit": "2",
        "X-RateLimit-Remaining": "0"
      }
    })

    resetRateLimitStore(store)
    await expect(
      consumeRateLimit(store, {
        key: "api:user:agent-1",
        limit: 2,
        windowMs: 60_000,
        now: 3_000
      })
    ).resolves.toMatchObject({ allowed: true })
  })

  it("uses the first forwarded IP as the client IP", () => {
    expect(
      getClientIp(
        new Request("http://localhost/api/mobile/dashboard", {
          headers: {
            "x-forwarded-for": "203.0.113.10, 198.51.100.7",
            "x-real-ip": "198.51.100.20"
          }
        })
      )
    ).toBe("203.0.113.10")
  })

  it("consumes multiple rate-limit keys in one store operation", async () => {
    const store = createMemoryRateLimitStore()
    const first = await consumeRateLimits(store, {
      limits: [
        {
          key: "api:ip:203.0.113.10",
          limit: 2,
          windowMs: 60_000
        },
        {
          key: "api:user:agent-1",
          limit: 1,
          windowMs: 60_000
        }
      ],
      now: 10_000
    })
    const blocked = await consumeRateLimits(store, {
      limits: [
        {
          key: "api:ip:203.0.113.10",
          limit: 2,
          windowMs: 60_000
        },
        {
          key: "api:user:agent-1",
          limit: 1,
          windowMs: 60_000
        }
      ],
      now: 11_000
    })

    expect(first.every((result) => result.allowed)).toBe(true)
    expect(blocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "api:user:agent-1",
          allowed: false,
          headers: expect.objectContaining({
            "Retry-After": "59"
          })
        })
      ])
    )
  })

  it("falls back to single-key RPCs when the batch RPC is not migrated yet", async () => {
    const resetAt = "2026-05-04T17:01:00.000Z"
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.consume_rate_limits(p_limits, p_now) in the schema cache"
        }
      })
      .mockResolvedValueOnce({
        data: [
          {
            allowed: true,
            remaining: 4,
            reset_at: resetAt
          }
        ],
        error: null
      })
      .mockResolvedValueOnce({
        data: [
          {
            allowed: true,
            remaining: 9,
            reset_at: resetAt
          }
        ],
        error: null
      })
    const store = createSupabaseRateLimitStore({ rpc } as never)

    const results = await consumeRateLimits(store, {
      limits: [
        {
          key: "mobile:pre-auth:ip:203.0.113.10",
          limit: 5,
          windowMs: 60_000
        },
        {
          key: "mobile:pre-auth:route:GET:/api/mobile/home:ip:203.0.113.10",
          limit: 10,
          windowMs: 60_000
        }
      ],
      now: Date.parse("2026-05-04T17:00:00.000Z")
    })

    expect(results).toEqual([
      expect.objectContaining({
        key: "mobile:pre-auth:ip:203.0.113.10",
        allowed: true,
        remaining: 4
      }),
      expect.objectContaining({
        key: "mobile:pre-auth:route:GET:/api/mobile/home:ip:203.0.113.10",
        allowed: true,
        remaining: 9
      })
    ])
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "consume_rate_limits",
      expect.objectContaining({
        p_limits: expect.any(Array)
      })
    )
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "consume_rate_limit",
      expect.objectContaining({
        p_key: "mobile:pre-auth:ip:203.0.113.10"
      })
    )
    expect(rpc).toHaveBeenNthCalledWith(
      3,
      "consume_rate_limit",
      expect.objectContaining({
        p_key: "mobile:pre-auth:route:GET:/api/mobile/home:ip:203.0.113.10"
      })
    )
  })
})
