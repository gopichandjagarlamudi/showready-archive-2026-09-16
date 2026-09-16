import { afterEach, describe, expect, it } from "vitest"
import { getAdminOwnerEmail, getSupabaseAnonKey } from "./env"

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

describe("admin env helpers", () => {
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const originalOwnerEmail = process.env.ADMIN_OWNER_EMAIL

  afterEach(() => {
    if (originalAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
    }

    if (originalOwnerEmail === undefined) {
      delete process.env.ADMIN_OWNER_EMAIL
    } else {
      process.env.ADMIN_OWNER_EMAIL = originalOwnerEmail
    }
  })

  it("rejects service role keys from browser-exposed Supabase env", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = createSupabaseJwt("service_role")

    expect(() => getSupabaseAnonKey()).toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must be a Supabase anon or publishable key."
    )
  })

  it("rejects sb_secret_ keys from browser-exposed Supabase env", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_secret_replace_me"

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

  it("lowercases and trims admin owner email", () => {
    process.env.ADMIN_OWNER_EMAIL = "  Owner@Example.com  "
    expect(getAdminOwnerEmail()).toBe("owner@example.com")
  })

  it("throws when admin owner email is empty", () => {
    process.env.ADMIN_OWNER_EMAIL = "   "
    expect(() => getAdminOwnerEmail()).toThrow("ADMIN_OWNER_EMAIL must not be empty.")
  })
})
