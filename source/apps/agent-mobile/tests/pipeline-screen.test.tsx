import { fireEvent, render, waitFor } from "@testing-library/react-native"
import type { PipelineLead, PipelineLeadListResponse } from "@showready/contracts"
import PipelineScreen from "../app/(app)/pipeline"

jest.mock(
  "@react-native-community/datetimepicker",
  () => {
    const React = require("react")
    const { Pressable, Text } = require("react-native")

    return function MockDateTimePicker(props: {
      mode: "date" | "time"
      onChange: (event: { type: string }, date?: Date) => void
      testID?: string
    }) {
      return React.createElement(
        Pressable,
        {
          testID: props.testID,
          onPress: () => props.onChange({ type: "set" }, new Date(2026, 3, 22, 9, 0))
        },
        React.createElement(Text, null, props.mode)
      )
    }
  },
  { virtual: true }
)

jest.mock("../providers/session-provider", () => ({
  useSession: jest.fn(),
  useMobileApi: jest.fn()
}))

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn()
  }
}))

const { useSession, useMobileApi } = jest.requireMock("../providers/session-provider") as {
  useSession: jest.Mock
  useMobileApi: jest.Mock
}
const { router } = jest.requireMock("expo-router") as {
  router: {
    push: jest.Mock
  }
}

function pipelineLead(input: Partial<PipelineLead> & Pick<PipelineLead, "id" | "buyerName">): PipelineLead {
  return {
    id: input.id,
    agentId: "agent-1",
    intakeType: input.intakeType ?? "sale",
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail ?? `${input.id}@example.com`,
    status: "submitted",
    pipelineStage: input.pipelineStage ?? "ready_to_show",
    submittedAt: input.submittedAt ?? "2026-04-20T12:00:00.000Z",
    score: input.score ?? 8.4,
    recommendation: input.recommendation ?? "show",
    summary: input.summary ?? "Ready to tour.",
    createdAt: input.createdAt ?? "2026-04-20T12:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-04-22T12:00:00.000Z",
    lastMovementAt: input.lastMovementAt ?? "2026-04-22T12:00:00.000Z",
    attentionReason: input.attentionReason
  }
}

describe("PipelineScreen", () => {
  let listPipelineLeads: jest.Mock<Promise<PipelineLeadListResponse>, [Record<string, unknown>]>
  let moveLead: jest.Mock

  beforeEach(() => {
    useSession.mockReturnValue({
      session: {
        user: {
          id: "agent-1"
        }
      },
      workspaceVersion: 0
    })

    router.push.mockReset()

    moveLead = jest.fn(async (leadId: string, stage: string) => ({
      lead: {
        ...pipelineLead({ id: leadId, buyerName: "Riley Ready" }),
        pipelineStage: stage
      }
    }))

    listPipelineLeads = jest.fn(async (input: Record<string, unknown>) => {
      if (input.offset === 25) {
        return {
          leads: [
            pipelineLead({
              id: "lead-page-2",
              buyerName: "Jordan Later",
              attentionReason: "Recently reviewed active lead."
            })
          ],
          total: 26,
          mode: "filtered_results" as const,
          summaryLabel: "26 active leads"
        }
      }

      return {
        leads: [
          pipelineLead({
            id: "lead-ready",
            buyerName: "Riley Ready",
            intakeType: "rental",
            attentionReason: "Ready to show with no appointment scheduled."
          })
        ],
        total: 26,
        nextOffset: 25,
        mode: "focus_queue" as const,
        summaryLabel: "Top 25 of 1,248 active leads"
      }
    })

    useMobileApi.mockReturnValue({
      listPipelineLeads,
      moveLead
    })
  })

  it("loads the server-ranked attention queue and appends the next page on request", async () => {
    const screen = render(<PipelineScreen />)

    expect(await screen.findByText("Top 25 of 1,248 active leads")).toBeTruthy()
    expect(screen.getByText("Ready to show with no appointment scheduled.")).toBeTruthy()
    expect(listPipelineLeads).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: "active",
        category: "all",
        limit: 25,
        offset: 0
      })
    )

    fireEvent.press(screen.getByTestId("pipeline-load-more"))

    await waitFor(() => {
      expect(screen.getByTestId("pipeline-card-lead-page-2")).toBeTruthy()
    })
    expect(screen.getByTestId("pipeline-card-lead-ready")).toBeTruthy()
    expect(listPipelineLeads).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 25
      })
    )
  })

  it("applies stage filters through the filter sheet", async () => {
    const screen = render(<PipelineScreen />)

    expect(await screen.findByTestId("pipeline-filter-button")).toBeTruthy()

    fireEvent.press(screen.getByTestId("pipeline-filter-button"))
    fireEvent.press(screen.getByTestId("pipeline-stage-option-nurture"))
    fireEvent.press(screen.getByTestId("pipeline-filter-apply"))

    await waitFor(() => {
      expect(listPipelineLeads).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "nurture",
          offset: 0
        })
      )
    })
  })

  it("applies rent and buy category filters and labels lead cards by intent", async () => {
    const screen = render(<PipelineScreen />)

    expect(await screen.findByTestId("pipeline-intent-chip-lead-ready")).toBeTruthy()
    expect(screen.getByText("Rent")).toBeTruthy()

    fireEvent.press(screen.getByTestId("pipeline-filter-button"))
    expect(screen.getByText("Buy")).toBeTruthy()
    fireEvent.press(screen.getByTestId("pipeline-stage-option-rent"))
    fireEvent.press(screen.getByTestId("pipeline-filter-apply"))

    await waitFor(() => {
      expect(listPipelineLeads).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "rent",
          offset: 0
        })
      )
    })
  })

  it("reloads the current pipeline after moving a lead within the same view", async () => {
    const screen = render(<PipelineScreen />)

    expect(await screen.findByTestId("pipeline-card-lead-ready")).toBeTruthy()

    fireEvent.press(screen.getByTestId("pipeline-open-stage-sheet-lead-ready"))
    fireEvent.press(screen.getByTestId("pipeline-move-lead-ready-nurture"))

    await waitFor(() => {
      expect(moveLead).toHaveBeenCalledWith("lead-ready", "nurture")
      expect(listPipelineLeads).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByTestId("pipeline-card-lead-ready")).toBeTruthy()
  })

  it("applies submitted-date presets and native picker dates as API ranges", async () => {
    const screen = render(<PipelineScreen />)

    expect(await screen.findByTestId("pipeline-filter-button")).toBeTruthy()

    fireEvent.press(screen.getByTestId("pipeline-filter-button"))
    fireEvent.press(screen.getByTestId("pipeline-date-preset-yesterday"))
    fireEvent.press(screen.getByTestId("pipeline-filter-apply"))

    await waitFor(() => {
      expect(listPipelineLeads).toHaveBeenCalledWith(
        expect.objectContaining({
          submittedFrom: expect.any(String),
          submittedTo: expect.any(String),
          offset: 0
        })
      )
    })

    fireEvent.press(screen.getByTestId("pipeline-filter-button"))
    fireEvent.press(screen.getByTestId("pipeline-date-preset-pick_date"))
    fireEvent.press(screen.getByTestId("pipeline-native-date-picker"))
    fireEvent.press(screen.getByTestId("pipeline-filter-apply"))

    await waitFor(() => {
      expect(listPipelineLeads).toHaveBeenLastCalledWith(
        expect.objectContaining({
          submittedFrom: expect.stringContaining("2026-04-22"),
          submittedTo: expect.any(String)
        })
      )
    })
  })

  it("opens settings from the pipeline header", async () => {
    const screen = render(<PipelineScreen />)

    fireEvent.press(await screen.findByTestId("pipeline-settings-button"))

    expect(router.push).toHaveBeenCalledWith("/settings")
  })
})
