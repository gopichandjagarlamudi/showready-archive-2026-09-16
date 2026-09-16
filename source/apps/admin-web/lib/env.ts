const SECRET_KEY_PREFIX = "sb_secret_"
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  let buffer = 0
  let bits = 0
  let output = ""

  for (const char of padded.replace(/=+$/, "")) {
    const value = BASE64_ALPHABET.indexOf(char)

    if (value < 0) {
      return null
    }

    buffer = (buffer << 6) | value
    bits += 6

    if (bits >= 8) {
      bits -= 8
      output += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }

  return output
}

function getJwtRole(value: string) {
  const [, payload] = value.split(".")

  if (!payload) {
    return null
  }

  try {
    const decoded = decodeBase64Url(payload)
    const parsed = decoded ? JSON.parse(decoded) : null

    return typeof parsed?.role === "string" ? parsed.role : null
  } catch {
    return null
  }
}

function assertPublicSupabaseKey(envName: string, value: string) {
  if (value.startsWith(SECRET_KEY_PREFIX) || getJwtRole(value) === "service_role") {
    throw new Error(`${envName} must be a Supabase anon or publishable key.`)
  }
}

export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.")
  }

  return value
}

export function getSupabaseAnonKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  }

  assertPublicSupabaseKey("NEXT_PUBLIC_SUPABASE_ANON_KEY", value)

  return value
}

export function getAdminOwnerEmail() {
  const value = process.env.ADMIN_OWNER_EMAIL

  if (!value) {
    throw new Error("Missing ADMIN_OWNER_EMAIL.")
  }

  const normalized = value.trim().toLowerCase()

  if (normalized.length === 0) {
    throw new Error("ADMIN_OWNER_EMAIL must not be empty.")
  }

  return normalized
}

export function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!value) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.")
  }

  return value
}
