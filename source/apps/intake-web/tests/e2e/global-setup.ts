import { readFileSync } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { FullConfig } from "@playwright/test"
import { createSupabaseAdminClient } from "../../lib/supabase/admin"

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  const contents = readFileSync(envPath, "utf8")

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
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith("\"") && value.endsWith("\""))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

async function resolveAgentId() {
  const client = createSupabaseAdminClient()

  const { data: settings, error: settingsError } = await client
    .from("agent_settings")
    .select("agent_id")
    .limit(1)
    .maybeSingle()

  if (settingsError) {
    throw settingsError
  }

  if (settings?.agent_id) {
    return settings.agent_id
  }

  const { data: agent, error: agentError } = await client
    .from("agents")
    .select("id")
    .limit(1)
    .maybeSingle()

  if (agentError) {
    throw agentError
  }

  if (!agent?.id) {
    throw new Error("Playwright e2e could not resolve an agent id.")
  }

  return agent.id
}

export default async function globalSetup(_config: FullConfig) {
  loadLocalEnv()

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ]
  const missing = required.filter((name) => !process.env[name])

  if (missing.length > 0) {
    throw new Error(`Playwright e2e requires Supabase env vars: ${missing.join(", ")}`)
  }

  const client = createSupabaseAdminClient()
  const { data: invite, error: inviteError } = await client
    .from("invites")
    .insert({
      agent_id: await resolveAgentId(),
      token: randomUUID(),
      status: "generated",
      token_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      draft_payload: {
        contact: {
          fullName: ""
        }
      },
      updated_at: new Date().toISOString()
    })
    .select("token")
    .single()

  if (inviteError) {
    throw inviteError
  }

  process.env.PLAYWRIGHT_INTAKE_TOKEN = invite.token
}
