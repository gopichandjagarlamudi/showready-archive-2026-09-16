const fs = require("node:fs")
const path = require("node:path")
const { createClient } = require("@supabase/supabase-js")
const {
  buildMaestroAuthUrlOutput,
  resolveDemoCredentials
} = require("./maestro-demo-config.cjs")

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

function requireEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

async function main() {
  loadLocalEnv()

  const appUrl = process.env.APP_URL ?? DEFAULT_AUTH_CALLBACK_BASE_URL
  const credentials = resolveDemoCredentials()
  const client = createClient(
    requireEnv("EXPO_PUBLIC_SUPABASE_URL"),
    requireEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
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

  const outputPath = path.join(__dirname, "..", ".maestro-auth-url")
  const output = buildMaestroAuthUrlOutput(appUrl, data.session, outputPath)
  fs.writeFileSync(outputPath, output.fullUrl, { mode: 0o600 })
  console.log(output.stdout)
  console.error(output.stderr)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
