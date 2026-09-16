import { describe, expect, it } from "vitest"
import type { PipelineLead } from "@showready/contracts"
import { buildFocusQueue, getPipelineDisplayStage } from "./pipeline"

function lead(input: Partial<PipelineLead> & Pick<PipelineLead, "id" | "pipelineStage">): PipelineLead {
  return {
    id: input.id,
    agentId: "agent-1",
    intakeType: "sale",
    buyerName: input.buyerName ?? input.id,
    buyerEmail: `${input.id}@example.com`,
    status: "submitted",
    pipelineStage: input.pipelineStage,
    submittedAt: input.submittedAt ?? "2026-04-20T12:00:00.000Z",
    score: input.score,
    recommendation: input.recommendation,
    summary: input.summary,
    createdAt: input.createdAt ?? "2026-04-20T12:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-04-20T12:00:00.000Z",
    reviewedAt: input.reviewedAt,
    reviewedStage: input.reviewedStage,
    review: input.review,
    lastMovementAt: input.lastMovementAt,
    attentionReason: input.attentionReason
  }
}

describe("pipeline lead helpers", () => {
  it("maps appointment booked leads back to their reviewed display stage", () => {
    expect(
      getPipelineDisplayStage(
        lead({
          id: "appointment-ready",
          pipelineStage: "appointment_booked",
          reviewedStage: "ready_to_show",
          recommendation: "show"
        })
      )
    ).toBe("ready_to_show")
  })

  it("builds a capped focus queue while keeping stale leads out of the default view", () => {
    const now = new Date("2026-04-29T12:00:00.000Z")
    const result = buildFocusQueue(
      [
        lead({ id: "new-lead", pipelineStage: "new", score: 9, recommendation: "show" }),
        lead({ id: "resolved", pipelineStage: "closed_won", score: 9, recommendation: "show" }),
        lead({
          id: "appointment",
          pipelineStage: "ready_to_show",
          score: 7,
          recommendation: "show",
          updatedAt: "2026-04-28T12:00:00.000Z"
        }),
        lead({
          id: "ready-fresh",
          pipelineStage: "ready_to_show",
          score: 8.5,
          recommendation: "show",
          updatedAt: "2026-04-24T12:00:00.000Z"
        }),
        lead({
          id: "ready-stale",
          pipelineStage: "ready_to_show",
          score: 9.2,
          recommendation: "show",
          updatedAt: "2026-02-01T12:00:00.000Z"
        }),
        lead({
          id: "nurture-high",
          pipelineStage: "nurture",
          score: 7.5,
          recommendation: "nurture",
          updatedAt: "2025-12-01T12:00:00.000Z"
        }),
        lead({
          id: "hold-stale",
          pipelineStage: "hold",
          score: 4,
          recommendation: "hold",
          updatedAt: "2026-01-01T12:00:00.000Z"
        })
      ],
      new Map([
        [
          "appointment",
          {
            date: "2026-04-30",
            startTime: "14:30"
          }
        ]
      ]),
      new Map(),
      now,
      25
    )

    expect(result.map((row) => row.id)).toEqual(["appointment", "ready-fresh", "nurture-high"])
    expect(result[0].attentionReason).toContain("Showing scheduled")
    expect(result[1].attentionReason).toBe("Ready to show with no appointment scheduled.")
    expect(result.find((row) => row.id === "new-lead")).toBeUndefined()
    expect(result.find((row) => row.id === "hold-stale")).toBeUndefined()
  })
})
