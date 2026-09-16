import { describe, expect, it, vi } from "vitest"
import type { IntakeDraft, Lead, LeadStage } from "@showready/contracts"
import {
  autosaveIntakeStep,
  createInviteLink,
  getAdminAgentDetail,
  getAdminDashboardOverview,
  listAdminAgents,
  listAdminFeedback,
  loadDashboardSummary,
  reviewLeadSubmission,
  saveAppointment,
  saveSettingsProfile,
  submitIntakeDraft
} from "../src/use-cases"

describe("application use cases", () => {
  it("loads dashboard summary from analytics gateway", async () => {
    const gateway = {
      getDashboardSummary: vi.fn(async () => ({
        totalLeads: 12,
        newLeads: 5,
        readyToShow: 2,
        appointmentBooked: 1,
        nurture: 4,
        hold: 3,
        averageScore: 7.2
      }))
    }

    const summary = await loadDashboardSummary(gateway)

    expect(summary.averageScore).toBe(7.2)
    expect(gateway.getDashboardSummary).toHaveBeenCalledOnce()
  })

  it("reviews a new lead with allowed stages only", async () => {
    const lead = { id: "lead-1" } as Lead
    const gateway = {
      reviewLead: vi.fn(async (leadId: string, stage: LeadStage) => ({
        ...lead,
        id: leadId,
        pipelineStage: stage
      }))
    }

    const result = await reviewLeadSubmission(gateway, "lead-1", "nurture")

    expect(result.pipelineStage).toBe("nurture")
    expect(gateway.reviewLead).toHaveBeenCalledWith("lead-1", "nurture")
  })

  it("rejects review transitions outside the review queue rules", async () => {
    const gateway = {
      reviewLead: vi.fn()
    }

    await expect(
      reviewLeadSubmission(
        gateway,
        "lead-1",
        "closed_won" as Extract<LeadStage, "ready_to_show" | "nurture" | "hold">
      )
    ).rejects.toThrow("Review stage must be ready_to_show, nurture, or hold.")
  })

  it("submits intake drafts through the intake gateway", async () => {
    const draft: IntakeDraft = {
      contact: {
        fullName: "Casey Client",
        email: "casey@example.com"
      },
      intent: "buy",
      buyer: {
        buyingFor: "myself",
        timeline: "within_1_month",
        budgetKnowledge: "know_it",
        mortgageStatus: "pre_approved",
        neighborhoods: "East End",
        propertyType: ["townhouse"]
      }
    }
    const gateway = {
      submitDraft: vi.fn(async (_token: string, _draft: IntakeDraft) => ({
        lead: {
          id: "lead-1",
          buyerName: "Casey Client"
        } as Lead
      }))
    }

    const result = await submitIntakeDraft(gateway, "invite-token", draft)

    expect(result.lead.id).toBe("lead-1")
    expect(gateway.submitDraft).toHaveBeenCalledWith("invite-token", draft)
  })

  it("passes appointment payloads through after normalization responsibility stays below the use case", async () => {
    const gateway = {
      saveAppointment: vi.fn(async (input: { leadId: string }) => ({
        id: "appt-1",
        leadId: input.leadId,
        date: "2026-04-21",
        startTime: "14:00",
        status: "scheduled" as const,
        createdAt: "2026-04-21T00:00:00.000Z",
        lead: {
          id: input.leadId,
          buyerName: "Casey Client",
          pipelineStage: "ready_to_show" as const
        },
        showings: []
      }))
    }

    const result = await saveAppointment(gateway, {
      leadId: "lead-1",
      date: "2026-04-21",
      startTime: "14:00",
      showings: [{ address: "123 Main St" }]
    })

    expect(result.id).toBe("appt-1")
  })

  it("delegates intake autosave, invite creation, and settings persistence", async () => {
    const intakeGateway = {
      autosaveDraft: vi.fn(async () => ({ ok: true as const }))
    }
    const inviteGateway = {
      createInvite: vi.fn(async () => ({
        token: "token-1",
        shareUrl: "https://example.com/intake/token-1",
        expiresAt: "2026-04-26T00:00:00.000Z"
      }))
    }
    const settingsGateway = {
      saveSettings: vi.fn(async () => ({ ok: true as const }))
    }

    await autosaveIntakeStep(intakeGateway, "token-1", {
      contact: { fullName: "Casey" }
    })
    const invite = await createInviteLink(inviteGateway)
    const saved = await saveSettingsProfile(settingsGateway, {
      fullName: "Casey Agent",
      emailNotificationsEnabled: false
    })

    expect(invite.token).toBe("token-1")
    expect(saved.ok).toBe(true)
  })

  it("loads all admin dashboard reads through the admin gateway", async () => {
    const gateway = {
      getOverview: vi.fn(async () => ({ rangeDays: 30 as const, metrics: [], dailyEventVolume: [], errorGroups: [] })),
      listAgents: vi.fn(async () => ({ items: [], total: 0 })),
      getAgentDetail: vi.fn(async () => null),
      listFeedback: vi.fn(async () => ({ items: [], total: 0 }))
    }

    await getAdminDashboardOverview(gateway, 30)
    await listAdminAgents(gateway, { query: "Morgan", rangeDays: 30, offset: 0, pageSize: 25 })
    await getAdminAgentDetail(gateway, "00000000-0000-4000-8000-000000000001", 30)
    await listAdminFeedback(gateway, { query: "", rangeDays: 7, offset: 0, pageSize: 25 })

    expect(gateway.getOverview).toHaveBeenCalledWith(30)
    expect(gateway.listAgents).toHaveBeenCalledWith({ query: "Morgan", rangeDays: 30, offset: 0, pageSize: 25 })
    expect(gateway.getAgentDetail).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", 30)
    expect(gateway.listFeedback).toHaveBeenCalledWith({ query: "", rangeDays: 7, offset: 0, pageSize: 25 })
  })
})
