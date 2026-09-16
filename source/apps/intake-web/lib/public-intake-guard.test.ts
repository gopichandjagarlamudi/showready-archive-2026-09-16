import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  assertPublicIntakePayloadAllowed,
  guardPublicIntakeRequest,
  resetPublicIntakeRateLimits
} from "./public-intake-guard"

describe("public intake guard", () => {
  beforeEach(() => {
    resetPublicIntakeRateLimits()
    vi.useRealTimers()
  })

  it("rejects non-json public intake writes", async () => {
    const result = await guardPublicIntakeRequest(
      new Request("http://localhost/api/intake/token/autosave", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-forwarded-for": "203.0.113.10"
        },
        body: "not json"
      }),
      "token",
      "autosave"
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected guard to reject non-json request.")
    }
    expect(result.status).toBe(415)
  })

  it("rejects oversized public intake writes", async () => {
    const result = await guardPublicIntakeRequest(
      new Request("http://localhost/api/intake/token/autosave", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "70000",
          "x-forwarded-for": "203.0.113.10"
        },
        body: "{}"
      }),
      "token",
      "autosave"
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected guard to reject oversized request.")
    }
    expect(result.status).toBe(413)
  })

  it("rate limits repeated submit attempts by token and IP", async () => {
    const request = () =>
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.25"
        },
        body: "{}"
      })

    for (let index = 0; index < 5; index += 1) {
      expect((await guardPublicIntakeRequest(request(), "token", "submit")).ok).toBe(true)
    }

    const blocked = await guardPublicIntakeRequest(request(), "token", "submit")
    expect(blocked.ok).toBe(false)
    if (blocked.ok) {
      throw new Error("Expected guard to rate limit submit attempts.")
    }
    expect(blocked.status).toBe(429)
  })

  it("rate limits a submit token across different IP addresses", async () => {
    for (let index = 0; index < 5; index += 1) {
      const request = new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `203.0.113.${index + 1}`
        },
        body: "{}"
      })

      expect((await guardPublicIntakeRequest(request, "token", "submit")).ok).toBe(true)
    }

    const blocked = await guardPublicIntakeRequest(
      new Request("http://localhost/api/intake/token/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.99"
        },
        body: "{}"
      }),
      "token",
      "submit"
    )

    expect(blocked.ok).toBe(false)
    if (blocked.ok) {
      throw new Error("Expected guard to rate limit token-wide submit attempts.")
    }
    expect(blocked.status).toBe(429)
    expect(blocked.headers).toEqual(expect.objectContaining({ "Retry-After": "60" }))
  })

  it("rejects honeypot values and unrealistically fast submits", () => {
    vi.setSystemTime(new Date("2026-04-29T12:00:00.000Z"))

    expect(() =>
      assertPublicIntakePayloadAllowed({
        draft: { contact: { fullName: "Taylor" } },
        guard: {
          startedAt: Date.now() - 2000,
          website: "https://spam.example"
        }
      })
    ).toThrow("Unable to save your progress right now.")

    expect(() =>
      assertPublicIntakePayloadAllowed(
        {
          draft: { contact: { fullName: "Taylor" } },
          guard: {
            startedAt: Date.now() - 500,
            website: ""
          }
        },
        "submit"
      )
    ).toThrow("Please try submitting again.")
  })
})
