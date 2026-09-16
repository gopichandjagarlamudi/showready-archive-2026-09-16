import { afterEach, describe, expect, it } from "vitest"
import { getSupabaseAnonKey } from "./env"

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function createSupabaseJwt(role: string) {
  return [
    encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    encodeBase64Url(JSON.stringify({ role })),
    "signature"
  ].join(".")
}

describe("Supabase env helpers", () => {
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  afterEach(() => {
    if (originalAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      return
    }

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
  })

  it("rejects service role keys from browser-exposed Supabase env", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = createSupabaseJwt("service_role")

    expect(() => getSupabaseAnonKey()).toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must be a Supabase anon or publishable key."
    )
  })

  it("accepts anon JWT and publishable Supabase keys", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = createSupabaseJwt("anon")
    expect(getSupabaseAnonKey()).toBe(createSupabaseJwt("anon"))

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test"
    expect(getSupabaseAnonKey()).toBe("sb_publishable_test")
  })
})
