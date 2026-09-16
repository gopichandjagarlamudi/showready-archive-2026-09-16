const fs = require("node:fs")
const path = require("node:path")
const { randomUUID } = require("node:crypto")
const { createClient } = require("@supabase/supabase-js")
const { resolveDemoCredentials } = require("./maestro-demo-config.cjs")

const DEMO_AGENT_ID = "9c0b8ef5-1b2f-4b4c-8d6a-9b4e0f7d3c51"
const SALE_TEMPLATE_ID = "8ce0d0bb-20cc-4cf9-8a78-a2b1ff5c80d2"
const RENTAL_TEMPLATE_ID = "0f59c77c-f4ea-4ef4-b381-c8b72fc64658"
const SETTINGS_ID = "f14587f2-6ad8-41a7-a08e-e7fd692f18fa"

const DEMO_LEADS = [
  {
    id: "e357e934-6f9a-4d75-bf12-8db0cd1bf701",
    inviteId: "3a9c4964-fc2d-48ea-a7c0-431a7bb59977",
    scoreId: "e7a8e991-1c7a-41b1-b1a3-7e2197ef1f41",
    buyerName: "Maestro Review Lead",
    buyerEmail: "maestro.review@example.com",
    buyerPhone: "+1 416 555 0101",
    intakeType: "sale",
    token: randomUUID(),
    pipelineStage: "new",
    recommendation: "show",
    score: 9.2,
    summary: "High-intent buyer ready for agent review."
  },
  {
    id: "bd30eb53-5bc1-460d-95a2-13c2f7c5e2bb",
    inviteId: "e3ae9485-df2b-44ea-a537-811b33b1af3b",
    scoreId: "8caa8916-16b0-44ba-a4ee-c1de32eb6f1b",
    buyerName: "Maestro Appointment Lead",
    buyerEmail: "maestro.appointment@example.com",
    buyerPhone: "+1 647 555 0199",
    intakeType: "rental",
    token: randomUUID(),
    pipelineStage: "ready_to_show",
    recommendation: "show",
    score: 8.6,
    summary: "Qualified renter ready for a scheduled showing."
  },
  {
    id: "da26711a-69dd-4ce2-ab48-8efcf9811f14",
    inviteId: "4420f95b-b6c9-4bea-bf85-bf4af7bf77ae",
    scoreId: "c8526f41-53d7-4b4e-8689-b337322dbb09",
    buyerName: "Maestro Detail Lead",
    buyerEmail: "maestro.detail@example.com",
    buyerPhone: "+1 437 555 0188",
    intakeType: "sale",
    token: randomUUID(),
    pipelineStage: "nurture",
    recommendation: "nurture",
    score: 6.4,
    summary: "Qualified lead with enough context to exercise score overrides."
  }
]

function findDemoUser(users, email) {
  return users.find((user) => user.email === email) ?? users.find((user) => user.id === DEMO_AGENT_ID)
}

function requireEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", "..", "..", ".env.local")
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

async function getOrCreateDemoUser(client, credentials) {
  const { data: listed, error: listError } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 200
  })

  if (listError) {
    throw listError
  }

  const existing = findDemoUser(listed.users, credentials.email)
  if (existing) {
    const { data, error } = await client.auth.admin.updateUserById(existing.id, {
      email: credentials.email,
      password: credentials.password,
      email_confirm: true,
      user_metadata: {
        full_name: "Demo Agent"
      }
    })

    if (error) {
      throw error
    }

    return data.user
  }

  const { data, error } = await client.auth.admin.createUser({
    id: DEMO_AGENT_ID,
    email: credentials.email,
    password: credentials.password,
    email_confirm: true,
    user_metadata: {
      full_name: "Demo Agent"
    }
  })

  if (error) {
    throw error
  }

  return data.user
}

function isMissingColumnError(error, columnName) {
  return (
    (error?.code === "PGRST204" || error?.code === "42703") &&
    error?.message?.includes(columnName)
  )
}

async function insertAgentSettings(client, payload) {
  const { error } = await client.from("agent_settings").insert(payload)

  if (!error) {
    return
  }

  if (!isMissingColumnError(error, "email_notifications_enabled")) {
    throw error
  }

  const { email_notifications_enabled: _emailNotificationsEnabled, ...legacyPayload } = payload
  const { error: legacyError } = await client.from("agent_settings").insert({
    ...legacyPayload,
    notification_preference: "email"
  })

  if (legacyError) {
    throw legacyError
  }
}

async function seedAgentScaffold(client, agentId, credentials) {
  const now = new Date().toISOString()

  await client.from("agent_settings").delete().eq("agent_id", agentId)
  await client.from("question_templates").delete().eq("agent_id", agentId)

  const { error: agentError } = await client.from("agents").upsert(
    {
      id: agentId,
      email: credentials.email,
      full_name: "Demo Agent",
      brokerage: "Northline Realty",
      license_number: "SR-2026-001",
      onboarded_at: now
    },
    {
      onConflict: "id"
    }
  )

  if (agentError) {
    throw agentError
  }

  const { error: templateError } = await client.from("question_templates").insert([
    {
      id: SALE_TEMPLATE_ID,
      agent_id: agentId,
      intake_type: "sale",
      name: "Buyer intake",
      intro_headline: "Tell us about your next move",
      intro_body: "We use this to prioritize speed, budget clarity, and showing readiness.",
      custom_questions: []
    },
    {
      id: RENTAL_TEMPLATE_ID,
      agent_id: agentId,
      intake_type: "rental",
      name: "Rental intake",
      intro_headline: "Tell us about your rental search",
      intro_body: "We use this to prioritize urgency, documentation, and fit.",
      custom_questions: []
    }
  ])

  if (templateError) {
    throw templateError
  }

  await insertAgentSettings(client, {
    id: SETTINGS_ID,
    agent_id: agentId,
    brand_name: "ShowReady Advisory",
    brand_color: "#0F766E",
    accent_color: "#A16207",
    show_threshold: 8,
    email_notifications_enabled: false,
    question_template_id: SALE_TEMPLATE_ID
  })
}

async function resetLeadState(client, agentId) {
  const leadIds = DEMO_LEADS.map((lead) => lead.id)
  const inviteIds = DEMO_LEADS.map((lead) => lead.inviteId)
  const tokens = DEMO_LEADS.map((lead) => lead.token)

  const { data: appointments, error: appointmentsError } = await client
    .from("appointments")
    .select("id")
    .in("lead_id", leadIds)

  if (appointmentsError) {
    throw appointmentsError
  }

  const appointmentIds = (appointments ?? []).map((row) => row.id)

  if (appointmentIds.length > 0) {
    const { error: showingsError } = await client
      .from("showings")
      .delete()
      .in("appointment_id", appointmentIds)

    if (showingsError) {
      throw showingsError
    }
  }

  const { error: deleteAppointmentsError } = await client
    .from("appointments")
    .delete()
    .in("lead_id", leadIds)

  if (deleteAppointmentsError) {
    throw deleteAppointmentsError
  }

  await client.from("lead_scores").delete().in("lead_id", leadIds)
  await client.from("lead_answers").delete().in("lead_id", leadIds)
  await client.from("invites").delete().in("id", inviteIds)
  await client.from("invites").delete().in("token", tokens)
  await client.from("leads").delete().in("id", leadIds).eq("agent_id", agentId)
}

async function seedLeadState(client, agentId) {
  const now = new Date().toISOString()

  const { error: leadError } = await client.from("leads").insert(
    DEMO_LEADS.map((lead) => ({
      id: lead.id,
      agent_id: agentId,
      buyer_name: lead.buyerName,
      buyer_email: lead.buyerEmail,
      buyer_phone: lead.buyerPhone,
      intake_type: lead.intakeType,
      token: lead.token,
      token_expires_at: "2099-01-01T00:00:00.000Z",
      status: "submitted",
      pipeline_stage: lead.pipelineStage,
      score: lead.score,
      recommendation: lead.recommendation,
      summary: lead.summary,
      submitted_at: now,
      updated_at: now
    }))
  )

  if (leadError) {
    throw leadError
  }

  const { error: scoreError } = await client.from("lead_scores").insert(
    DEMO_LEADS.map((lead) => ({
      id: lead.scoreId,
      lead_id: lead.id,
      total: lead.score,
      recommendation: lead.recommendation,
      summary: lead.summary,
      breakdown: {},
      overridden: false
    }))
  )

  if (scoreError) {
    throw scoreError
  }

  const { error: inviteError } = await client.from("invites").insert(
    DEMO_LEADS.map((lead) => ({
      id: lead.inviteId,
      agent_id: agentId,
      token: lead.token,
      status: "converted",
      token_expires_at: "2099-01-01T00:00:00.000Z",
      draft_payload: {
        contact: {
          fullName: lead.buyerName,
          email: lead.buyerEmail,
          phone: lead.buyerPhone
        }
      },
      lead_id: lead.id,
      opened_at: now,
      converted_at: now,
      updated_at: now
    }))
  )

  if (inviteError) {
    throw inviteError
  }
}

async function main() {
  loadLocalEnv()
  const credentials = resolveDemoCredentials()

  const client = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const user = await getOrCreateDemoUser(client, credentials)
  await seedAgentScaffold(client, user.id, credentials)
  await resetLeadState(client, user.id)
  await seedLeadState(client, user.id)

  console.log(`Seeded Maestro demo state for ${credentials.email} (${user.id}).`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = {
  DEMO_AGENT_ID,
  findDemoUser
}
