/// <reference types="node" />

import {
  getApiBaseUrl,
  getPublicSiteUrl,
  getSupabaseAnonKey,
  resolveApiBaseUrl,
  resolvePublicSiteUrl,
} from "./env"

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

describe("env helpers", () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_BASE_URL
  const originalSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  const originalSiteUrl = process.env.EXPO_PUBLIC_SITE_URL

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalEnv
    }

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey
    }

    if (originalSiteUrl === undefined) {
      delete process.env.EXPO_PUBLIC_SITE_URL
    } else {
      process.env.EXPO_PUBLIC_SITE_URL = originalSiteUrl
    }
  })

  it("replaces localhost with the Expo host for device testing", () => {
    expect(resolveApiBaseUrl("http://localhost:3000", "192.168.5.13:8081")).toBe(
      "http://192.168.5.13:3000"
    )
  })

  it("keeps non-local api hosts unchanged", () => {
    expect(resolveApiBaseUrl("https://showready.example.com", "192.168.5.13:8081")).toBe(
      "https://showready.example.com"
    )
  })

  it("uses the configured env var when reading the mobile api base url", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000/"

    expect(getApiBaseUrl("192.168.5.13:8081")).toBe("http://192.168.5.13:3000")
  })

  it("rejects Supabase service role keys from public mobile env", () => {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = createSupabaseJwt("service_role")

    expect(() => getSupabaseAnonKey()).toThrow(
      "EXPO_PUBLIC_SUPABASE_ANON_KEY must be a Supabase anon or publishable key."
    )
  })

  it("accepts Supabase anon and publishable keys in public mobile env", () => {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = createSupabaseJwt("anon")
    expect(getSupabaseAnonKey()).toBe(createSupabaseJwt("anon"))

    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test"
    expect(getSupabaseAnonKey()).toBe("sb_publishable_test")
  })

  it("uses the canonical public site when no override is set", () => {
    delete process.env.EXPO_PUBLIC_SITE_URL
    expect(getPublicSiteUrl()).toBe("https://showreadyapp.com")
  })

  it("normalizes a valid HTTPS public origin", () => {
    expect(
      resolvePublicSiteUrl("https://preview.showreadyapp.com/"),
    ).toBe("https://preview.showreadyapp.com")
  })

  it.each([
    "http://showreadyapp.com",
    "https://user:pass@showreadyapp.com",
    "https://showreadyapp.com/legal",
    "https://showreadyapp.com?from=app",
    "https://showreadyapp.com#legal",
    "not-a-url",
  ])("rejects an invalid public origin: %s", (value) => {
    expect(() => resolvePublicSiteUrl(value)).toThrow(
      /EXPO_PUBLIC_SITE_URL/,
    )
  })
})
