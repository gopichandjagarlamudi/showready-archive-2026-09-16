const DEMO_CREDENTIALS_HELP =
  "Add MAESTRO_DEMO_EMAIL and MAESTRO_DEMO_PASSWORD to .env.local or export them before running Maestro auth flows."

function requireEnv(env, name) {
  const value = env[name]

  if (!value) {
    throw new Error(`Missing ${name}. ${DEMO_CREDENTIALS_HELP}`)
  }

  return value
}

function resolveDemoCredentials(env = process.env) {
  return {
    email: requireEnv(env, "MAESTRO_DEMO_EMAIL"),
    password: requireEnv(env, "MAESTRO_DEMO_PASSWORD")
  }
}

function buildCallbackBaseUrl(appUrl) {
  const parsed = new URL(appUrl)

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return appUrl
  }

  return `${appUrl.replace(/\/+$/, "")}/--/auth/callback`
}

function buildAuthCallbackUrl(appUrl, session) {
  const url = new URL(buildCallbackBaseUrl(appUrl))
  url.searchParams.set("access_token", session.access_token)
  url.searchParams.set("refresh_token", session.refresh_token)
  return url.toString()
}

function buildMaskedAuthCallbackUrl(appUrl, session) {
  const url = new URL(buildCallbackBaseUrl(appUrl))

  for (const key of Object.keys(session)) {
    url.searchParams.set(key, "[redacted]")
  }

  return url.toString()
}

function buildMaestroAuthUrlOutput(appUrl, session, outputPath) {
  const fullUrl = buildAuthCallbackUrl(appUrl, session)
  const maskedUrl = buildMaskedAuthCallbackUrl(appUrl, {
    access_token: session.access_token,
    refresh_token: session.refresh_token
  })

  return {
    fullUrl,
    stdout: fullUrl,
    stderr: `Redacted Maestro auth URL: ${maskedUrl}\nFull Maestro auth URL written to ${outputPath}.`
  }
}

module.exports = {
  buildAuthCallbackUrl,
  buildMaestroAuthUrlOutput,
  buildMaskedAuthCallbackUrl,
  resolveDemoCredentials
}
