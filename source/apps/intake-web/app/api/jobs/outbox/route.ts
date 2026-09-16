import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { trackServerEvent } from "@/lib/analytics"
import { isAuthorizedJobRequest } from "@/lib/job-auth"
import { sendLeadScoredEmail, sendLeadScoredPushNotifications } from "@/lib/notifications"
import { captureServerError, requestErrorResponse } from "@/lib/observability"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  claimOutboxJobs,
  claimRelatedPushNotificationJobs,
  completeOutboxJob,
  failOutboxJob,
  getAgentContext,
  getLeadById,
  listAgentPushTokens,
  recordProductEvents,
  type OutboxJob
} from "@/lib/supabase/data"

type AppSupabaseClient = ReturnType<typeof createSupabaseAdminClient>

const PUSH_NOTIFICATION_SUMMARY_THRESHOLD = 3
const PUSH_NOTIFICATION_GROUP_LIMIT = 50

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function isPushNotificationJob(job: OutboxJob) {
  return job.jobType === "intake.submitted.push_notifications"
}

function groupPushNotificationJobsByAgent(jobs: OutboxJob[]) {
  const grouped = new Map<string, OutboxJob[]>()

  for (const job of jobs) {
    if (!isPushNotificationJob(job)) {
      continue
    }

    grouped.set(job.agentId, [...(grouped.get(job.agentId) ?? []), job])
  }

  return grouped
}

async function processOutboxJob(supabase: AppSupabaseClient, job: OutboxJob) {
  const lead = await getLeadById(supabase, job.agentId, job.resourceId)

  if (!lead) {
    throw new Error("Lead not found for outbox job.")
  }

  if (job.jobType === "intake.submitted.product_event") {
    await recordProductEvents(supabase, job.agentId, [
      {
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        eventName: "intake.submitted",
        agentId: job.agentId,
        resourceType: "lead",
        resourceId: lead.id,
        platform: "web",
        properties: {
          recommendation: asString(job.payload.recommendation) ?? lead.recommendation ?? "nurture",
          scoreBand: asString(job.payload.scoreBand) ?? "low"
        }
      }
    ])
    return
  }

  if (job.jobType === "intake.submitted.push_notifications") {
    const pushTokens = await listAgentPushTokens(supabase, job.agentId)

    await sendLeadScoredPushNotifications({
      expoPushTokens: pushTokens,
      title: asString(job.payload.title) ?? "New lead submitted",
      body: asString(job.payload.body) ?? `${lead.buyerName} just submitted the intake form.`,
      data: {
        leadId: lead.id,
        route: "/(app)/new-leads"
      }
    })
    return
  }

  if (job.jobType === "intake.submitted.email") {
    const context = await getAgentContext(supabase, job.agentId)

    if (!context?.agent.email || !context.settings.emailNotificationsEnabled) {
      return
    }

    await sendLeadScoredEmail({
      to: context.agent.email,
      agentName: context.agent.fullName,
      buyerName: lead.buyerName,
      recommendation: lead.recommendation ?? "nurture",
      score: lead.score ?? 0,
      detailUrl: asString(job.payload.detailUrl) ?? ""
    })
    return
  }

  if (job.jobType === "intake.submitted.analytics") {
    await trackServerEvent(
      "intake.submitted",
      { recommendation: asString(job.payload.recommendation) ?? lead.recommendation ?? "nurture" },
      job.agentId
    )
    return
  }

  throw new Error(`Unsupported outbox job type: ${job.jobType}`)
}

async function failJob(supabase: AppSupabaseClient, job: OutboxJob, error: unknown) {
  captureServerError(error, "api.jobs.outbox")
  await failOutboxJob(
    supabase,
    job,
    error instanceof Error ? error.message : "Unable to process outbox job."
  )
}

async function processSingleJob(supabase: AppSupabaseClient, job: OutboxJob) {
  try {
    await processOutboxJob(supabase, job)
    await completeOutboxJob(supabase, job.id)
    return { processed: 1, failed: 0 }
  } catch (error) {
    await failJob(supabase, job, error)
    return { processed: 0, failed: 1 }
  }
}

async function processPushNotificationJobs(supabase: AppSupabaseClient, jobs: OutboxJob[]) {
  if (jobs.length <= PUSH_NOTIFICATION_SUMMARY_THRESHOLD) {
    let processed = 0
    let failed = 0

    for (const job of jobs) {
      const result = await processSingleJob(supabase, job)
      processed += result.processed
      failed += result.failed
    }

    return { processed, failed }
  }

  try {
    const pushTokens = await listAgentPushTokens(supabase, jobs[0].agentId)

    await sendLeadScoredPushNotifications({
      expoPushTokens: pushTokens,
      title: `${jobs.length} new leads submitted`,
      body: "Open ShowReady to review the latest intake submissions.",
      data: {
        route: "/(app)/new-leads",
        submissionCount: jobs.length
      }
    })

    for (const job of jobs) {
      await completeOutboxJob(supabase, job.id)
    }

    return { processed: jobs.length, failed: 0 }
  } catch (error) {
    captureServerError(error, "api.jobs.outbox")

    for (const job of jobs) {
      await failOutboxJob(
        supabase,
        job,
        error instanceof Error ? error.message : "Unable to process push notification jobs."
      )
    }

    return { processed: 0, failed: jobs.length }
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return requestErrorResponse({
      request,
      error: new Error("Unauthorized job request."),
      route: "api.jobs.outbox",
      status: 401,
      response: { error: "Unauthorized." }
    })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const jobs: OutboxJob[] = await claimOutboxJobs(supabase, 10)
    const pushJobsByAgent = groupPushNotificationJobsByAgent(jobs)
    const regularJobs = jobs.filter((job) => !isPushNotificationJob(job))
    let processed = 0
    let failed = 0

    for (const [agentId, initialPushJobs] of pushJobsByAgent) {
      try {
        const excludedJobIds = initialPushJobs.map((job) => job.id)
        const relatedPushJobs = await claimRelatedPushNotificationJobs(
          supabase,
          agentId,
          excludedJobIds,
          Math.max(0, PUSH_NOTIFICATION_GROUP_LIMIT - initialPushJobs.length)
        )
        const result = await processPushNotificationJobs(supabase, [
          ...initialPushJobs,
          ...relatedPushJobs
        ])
        processed += result.processed
        failed += result.failed
      } catch (error) {
        failed += initialPushJobs.length
        for (const job of initialPushJobs) {
          await failJob(supabase, job, error)
        }
      }
    }

    for (const job of regularJobs) {
      const result = await processSingleJob(supabase, job)
      processed += result.processed
      failed += result.failed
    }

    return NextResponse.json({
      claimed: jobs.length,
      processed,
      failed
    })
  } catch (error) {
    return requestErrorResponse({
      request,
      error,
      route: "api.jobs.outbox",
      status: 500,
      response: { error: "Unable to process outbox jobs." }
    })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
