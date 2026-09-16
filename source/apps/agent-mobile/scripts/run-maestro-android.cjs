const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { createClient } = require("@supabase/supabase-js")
const {
  buildAuthCallbackUrl,
  buildMaskedAuthCallbackUrl,
  resolveDemoCredentials
} = require("./maestro-demo-config.cjs")

const DEFAULT_APP_ID = "com.showready.mobile"
const DEFAULT_APP_OPEN_URL =
  "showready://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"
const DEFAULT_AUTH_CALLBACK_BASE_URL = "showready://auth/callback"

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", "..", "..", ".env.local")

  if (!fs.existsSync(envPath)) {
    return
  }

  const contents = fs.readFileSync(envPath, "utf8")

  for (const line of contents.split("\n")) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex < 0) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function firstEnv(...names) {
  for (const name of names) {
    if (process.env[name]) {
      return process.env[name]
    }
  }

  return undefined
}

function resolveAndroidMaestroEnv(env = process.env, generatedAuthUrl) {
  return {
    APP_ID: env.APP_ID ?? DEFAULT_APP_ID,
    APP_OPEN_URL: env.APP_OPEN_URL ?? DEFAULT_APP_OPEN_URL,
    AUTH_CALLBACK_URL: env.AUTH_CALLBACK_URL ?? generatedAuthUrl
  }
}

function buildAndroidMaestroArgs(suitePath, maestroEnv) {
  return [
    "test",
    "-e",
    `APP_ID=${maestroEnv.APP_ID}`,
    "-e",
    `APP_OPEN_URL=${maestroEnv.APP_OPEN_URL}`,
    "-e",
    `AUTH_CALLBACK_URL=${maestroEnv.AUTH_CALLBACK_URL}`,
    suitePath
  ]
}

async function buildAuthUrl() {
  const credentials = resolveDemoCredentials()
  const client = createClient(
    requireEnv("EXPO_PUBLIC_SUPABASE_URL", firstEnv("NEXT_PUBLIC_SUPABASE_URL")),
    requireEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", firstEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password
  })

  if (error || !data.session) {
    throw error ?? new Error("Unable to resolve a Supabase session for Maestro.")
  }

  const callbackBaseUrl = process.env.AUTH_CALLBACK_BASE_URL ?? DEFAULT_AUTH_CALLBACK_BASE_URL
  const authUrl = buildAuthCallbackUrl(callbackBaseUrl, data.session)
  const outputPath = path.join(__dirname, "..", ".maestro-auth-url")
  fs.writeFileSync(outputPath, authUrl, { mode: 0o600 })
  console.error(
    `Redacted Maestro auth URL: ${buildMaskedAuthCallbackUrl(callbackBaseUrl, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    })}`
  )
  console.error(`Full Maestro auth URL written to ${outputPath}.`)

  return authUrl
}

async function main() {
  loadLocalEnv()

  const suitePath = process.argv[2] ?? ".maestro/smoke-android.yaml"
  const generatedAuthUrl = process.env.AUTH_CALLBACK_URL ? undefined : await buildAuthUrl()
  const maestroEnv = resolveAndroidMaestroEnv(process.env, generatedAuthUrl)
  const result = spawnSync("maestro", buildAndroidMaestroArgs(suitePath, maestroEnv), {
    cwd: path.join(__dirname, ".."),
    env: process.env,
    stdio: "inherit"
  })

  if (result.error) {
    throw result.error
  }

  process.exit(result.status ?? 1)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

module.exports = {
  buildAndroidMaestroArgs,
  resolveAndroidMaestroEnv
}
