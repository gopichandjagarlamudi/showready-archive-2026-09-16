import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { AppState, Keyboard } from "react-native"
import LeadDetailScreen from "../app/lead/[id]"

jest.mock("../providers/session-provider", () => ({
  useSession: jest.fn(),
  useMobileApi: jest.fn()
}))

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ id: "lead-1" })),
  router: {
    canGoBack: jest.fn(() => true),
    back: jest.fn(),
    replace: jest.fn()
  }
}))

jest.mock("expo-linking", () => ({
  openURL: jest.fn(async () => true)
}))

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => true)
}))

jest.mock("../lib/diagnostics/service", () => ({
  captureDiagnosticsError: jest.fn(async () => {})
}))

const { useSession, useMobileApi } = jest.requireMock("../providers/session-provider") as {
  useSession: jest.Mock
  useMobileApi: jest.Mock
}

const { router } = jest.requireMock("expo-router") as {
  router: {
    canGoBack: jest.Mock
    back: jest.Mock
    replace: jest.Mock
  }
}

const Linking = jest.requireMock("expo-linking") as {
  openURL: jest.Mock
}

const Clipboard = jest.requireMock("expo-clipboard") as {
  setStringAsync: jest.Mock
}

const { captureDiagnosticsError } = jest.requireMock("../lib/diagnostics/service") as {
  captureDiagnosticsError: jest.Mock
}

function leadFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    agentId: "agent-1",
    intakeType: "sale",
    buyerName: "Taylor Verify",
    buyerEmail: "taylor@example.com",
    buyerPhone: "416-555-0101",
    token: "invite-token",
    tokenExpiresAt: "2026-04-27T00:00:00.000Z",
    status: "pending",
    pipelineStage: "new",
    submittedAt: "2026-04-20T12:00:00.000Z",
    score: 8.9,
    recommendation: "show",
    summary: "Ready to move.",
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z",
    answers: {
      contact: {
        fullName: "Taylor Verify",
        email: "taylor@example.com",
        phone: "416-555-0101"
      }
    },
    contactInteractions: [],
    review: {
      suggestedStage: "ready_to_show",
      reviewedStage: "ready_to_show",
      isReviewed: true,
      isOverride: false
    },
    ...overrides
  }
}

describe("LeadDetailScreen", () => {
  let getLeadById: jest.Mock
  let moveLead: jest.Mock
  let reviewLead: jest.Mock
  let updateLead: jest.Mock
  let deleteLead: jest.Mock
  let overrideLeadScore: jest.Mock
  let recordLeadContactInteraction: jest.Mock
  let appStateChangeListener: ((state: string) => void) | null = null
  let appStateAddEventListenerSpy: jest.SpyInstance

  beforeEach(() => {
    appStateChangeListener = null
    appStateAddEventListenerSpy = jest.spyOn(AppState, "addEventListener")
    appStateAddEventListenerSpy.mockImplementation((type, listener) => {
      if (type === "change") {
        appStateChangeListener = listener as (state: string) => void
      }

      return {
        remove: jest.fn()
      } as never
    })
    router.canGoBack.mockReturnValue(true)
    router.back.mockReset()
    router.replace.mockReset()
    Linking.openURL.mockReset()
    Linking.openURL.mockResolvedValue(true)
    Clipboard.setStringAsync.mockReset()
    Clipboard.setStringAsync.mockResolvedValue(true)
    captureDiagnosticsError.mockReset()
    useSession.mockReturnValue({
      workspaceVersion: 0
    })

    moveLead = jest.fn(async (_leadId: string, stage: string) => ({
      lead: leadFixture({ pipelineStage: stage })
    }))
    reviewLead = jest.fn(async (_leadId: string, stage: string) => ({
      lead: leadFixture({
        pipelineStage: stage,
        reviewedAt: "2026-05-03T15:30:00.000Z",
        reviewedStage: stage
      })
    }))
    updateLead = jest.fn(async (_leadId: string, input: Record<string, unknown>) => ({
      lead: leadFixture({
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        buyerPhone: input.buyerPhone,
        intakeType: input.intakeType
      })
    }))
    deleteLead = jest.fn(async () => ({ ok: true }))
    overrideLeadScore = jest.fn()
    recordLeadContactInteraction = jest.fn(async (_leadId: string, method: string) => ({
      interaction: {
        id: `interaction-${method}`,
        leadId: "lead-1",
        agentId: "agent-1",
        method,
        occurredAt: "2026-05-03T15:30:00.000Z"
      }
    }))
    getLeadById = jest.fn(async () =>
      leadFixture({
        contactInteractions: [
          {
            id: "interaction-1",
            leadId: "lead-1",
            agentId: "agent-1",
            method: "call",
            occurredAt: "2026-05-03T15:30:00.000Z"
          }
        ]
      })
    )

    useMobileApi.mockReturnValue({
      getLeadById,
      moveLead,
      reviewLead,
      updateLead,
      deleteLead,
      recordLeadContactInteraction,
      overrideLeadScore
    })
  })

  afterEach(() => {
    appStateAddEventListenerSpy.mockRestore()
  })

  it("shows an iOS-style back chevron and returns to the previous screen", async () => {
    const screen = render(<LeadDetailScreen />)

    await screen.findByTestId("lead-open-override-sheet-button")
    expect(
      screen.queryByText(
        "Review scoring context, move the lead through the pipeline, and preserve manual overrides with notes."
      )
    ).toBeNull()
    expect(screen.queryByTestId("lead-back-button")).toBeNull()

    fireEvent.press(screen.getByTestId("lead-back-chevron"))

    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it("routes secondary actions through lighter sheet flows", async () => {
    const screen = render(<LeadDetailScreen />)

    expect(await screen.findByTestId("lead-open-stage-sheet-button")).toBeTruthy()
    expect(screen.queryByTestId("lead-move-ready_to_show")).toBeNull()
    expect(screen.queryByTestId("lead-override-score-input")).toBeNull()

    fireEvent.press(screen.getByTestId("lead-open-override-sheet-button"))

    await waitFor(() => {
      expect(screen.getByTestId("lead-override-score-input")).toBeTruthy()
      expect(screen.getByTestId("lead-save-override-button")).toBeTruthy()
    })

    fireEvent.press(screen.getByTestId("lead-open-stage-sheet-button"))
    fireEvent.press(screen.getByTestId("lead-move-closed_won"))

    await waitFor(() => {
      expect(moveLead).toHaveBeenCalledWith("lead-1", "closed_won")
    })
  })

  it("exposes saved override context for native automation", async () => {
    getLeadById.mockResolvedValueOnce(
      leadFixture({
        scoreOverride: {
          id: "override-1",
          originalScore: 7.3,
          originalRecommendation: "nurture",
          overrideScore: 8.9,
          overrideRecommendation: "show",
          note: "Maestro override",
          createdAt: "2026-05-03T15:30:00.000Z",
          createdByAgentId: "agent-1"
        }
      })
    )

    const screen = render(<LeadDetailScreen />)

    expect(await screen.findByTestId("lead-score-override-summary")).toBeTruthy()
    expect(screen.getByText('Override: 8.90 with note "Maestro override"')).toBeTruthy()
  })

  it("updates lead contact details from the edit sheet", async () => {
    const screen = render(<LeadDetailScreen />)

    fireEvent.press(await screen.findByTestId("lead-open-edit-sheet-button"))
    fireEvent.changeText(screen.getByTestId("lead-edit-name-input"), "Taylor Updated")
    fireEvent.changeText(screen.getByTestId("lead-edit-email-input"), "updated@example.com")
    fireEvent.changeText(screen.getByTestId("lead-edit-phone-input"), "+1 416 555 0199")
    fireEvent.press(screen.getByTestId("lead-save-edit-button"))

    await waitFor(() => {
      expect(updateLead).toHaveBeenCalledWith("lead-1", {
        buyerName: "Taylor Updated",
        buyerEmail: "updated@example.com",
        buyerPhone: "+1 416 555 0199",
        intakeType: "sale"
      })
      expect(screen.getByText("Lead updated")).toBeTruthy()
    })
  })

  it("requires a contact method before saving lead edits", async () => {
    const screen = render(<LeadDetailScreen />)

    fireEvent.press(await screen.findByTestId("lead-open-edit-sheet-button"))
    fireEvent.changeText(screen.getByTestId("lead-edit-email-input"), "")
    fireEvent.changeText(screen.getByTestId("lead-edit-phone-input"), "")
    fireEvent.press(screen.getByTestId("lead-save-edit-button"))

    expect(screen.getByText("Add an email or phone number.")).toBeTruthy()
    expect(updateLead).not.toHaveBeenCalled()
  })

  it("deletes a lead and returns to the pipeline", async () => {
    const screen = render(<LeadDetailScreen />)

    fireEvent.press(await screen.findByTestId("lead-open-delete-sheet-button"))
    fireEvent.press(screen.getByTestId("lead-confirm-delete-button"))

    await waitFor(() => {
      expect(deleteLead).toHaveBeenCalledWith("lead-1")
      expect(router.replace).toHaveBeenCalledWith("/(app)/pipeline")
    })
  })

  it("exposes an explicit keyboard dismissal action in score override sheets", async () => {
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(jest.fn())
    const screen = render(<LeadDetailScreen />)

    fireEvent.press(await screen.findByTestId("lead-open-override-sheet-button"))
    fireEvent.press(screen.getByTestId("lead-override-dismiss-keyboard-button"))

    expect(dismissSpy).toHaveBeenCalledTimes(1)
    dismissSpy.mockRestore()
  })

  it("shows conditional contact actions and recent contact history", async () => {
    const screen = render(<LeadDetailScreen />)

    expect(await screen.findByTestId("lead-contact-call-button")).toBeTruthy()
    expect(screen.getByTestId("lead-contact-text-button")).toBeTruthy()
    expect(screen.getByTestId("lead-contact-email-button")).toBeTruthy()
    expect(screen.getByText("Contact history")).toBeTruthy()
    expect(screen.getByText(/Attempted call/)).toBeTruthy()

    getLeadById.mockResolvedValueOnce(
      leadFixture({
        buyerEmail: undefined,
        buyerPhone: undefined,
        answers: {
          contact: {
            fullName: "Taylor Verify"
          }
        },
        contactInteractions: []
      })
    )
    const noContactScreen = render(<LeadDetailScreen />)

    await noContactScreen.findByText("No contact attempts yet")
    expect(noContactScreen.queryByTestId("lead-contact-call-button")).toBeNull()
    expect(noContactScreen.queryByTestId("lead-contact-text-button")).toBeNull()
    expect(noContactScreen.queryByTestId("lead-contact-email-button")).toBeNull()
  })

  it("opens blank native contact URLs and records attempts", async () => {
    const screen = render(<LeadDetailScreen />)

    await screen.findByTestId("lead-contact-call-button")
    fireEvent.press(screen.getByTestId("lead-contact-call-button"))

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("tel:4165550101")
      expect(recordLeadContactInteraction).toHaveBeenCalledWith("lead-1", "call")
    })

    fireEvent.press(screen.getByTestId("lead-contact-text-button"))

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("sms:4165550101")
      expect(recordLeadContactInteraction).toHaveBeenCalledWith("lead-1", "text")
    })

    fireEvent.press(screen.getByTestId("lead-contact-email-button"))

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("mailto:taylor@example.com")
      expect(recordLeadContactInteraction).toHaveBeenCalledWith("lead-1", "email")
    })
  })

  it("copies contact values and still records attempts when native handoff fails", async () => {
    Linking.openURL.mockRejectedValueOnce(new Error("No handler"))
    const screen = render(<LeadDetailScreen />)

    await screen.findByTestId("lead-contact-text-button")
    fireEvent.press(screen.getByTestId("lead-contact-text-button"))

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith("416-555-0101")
      expect(recordLeadContactInteraction).toHaveBeenCalledWith("lead-1", "text")
      expect(screen.getByText("Contact copied")).toBeTruthy()
    })
  })

  it("shows a warning and captures diagnostics when saving the interaction fails", async () => {
    recordLeadContactInteraction.mockRejectedValueOnce(new Error("Save failed"))
    const screen = render(<LeadDetailScreen />)

    await screen.findByTestId("lead-contact-email-button")
    fireEvent.press(screen.getByTestId("lead-contact-email-button"))

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("mailto:taylor@example.com")
      expect(screen.getByText("Contact history unavailable")).toBeTruthy()
      expect(captureDiagnosticsError).toHaveBeenCalled()
    })
  })

  it("prompts new leads for review stage after returning from contact handoff", async () => {
    const screen = render(<LeadDetailScreen />)

    await screen.findByTestId("lead-contact-call-button")
    fireEvent.press(screen.getByTestId("lead-contact-call-button"))

    await waitFor(() => {
      expect(recordLeadContactInteraction).toHaveBeenCalledWith("lead-1", "call")
    })
    expect(screen.queryByTestId("lead-move-closed_won")).toBeNull()

    act(() => {
      appStateChangeListener?.("active")
    })

    await waitFor(() => {
      expect(screen.getByTestId("lead-move-ready_to_show")).toBeTruthy()
      expect(screen.queryByTestId("lead-move-closed_won")).toBeNull()
    })

    fireEvent.press(screen.getByTestId("lead-move-ready_to_show"))

    await waitFor(() => {
      expect(reviewLead).toHaveBeenCalledWith("lead-1", "ready_to_show")
    })
  })

  it("warns when the post-contact review sheet is dismissed without choosing a stage", async () => {
    const screen = render(<LeadDetailScreen />)

    await screen.findByTestId("lead-contact-call-button")
    fireEvent.press(screen.getByTestId("lead-contact-call-button"))

    await waitFor(() => {
      expect(recordLeadContactInteraction).toHaveBeenCalledWith("lead-1", "call")
    })

    act(() => {
      appStateChangeListener?.("active")
    })

    await screen.findByTestId("lead-stage-sheet-close")
    fireEvent.press(screen.getByTestId("lead-stage-sheet-close"))

    await waitFor(() => {
      expect(screen.getByText("Lead still in New")).toBeTruthy()
    })
    expect(reviewLead).not.toHaveBeenCalled()
  })
})
