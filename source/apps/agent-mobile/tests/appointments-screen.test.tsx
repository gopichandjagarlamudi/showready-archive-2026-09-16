import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { Keyboard } from "react-native"
import AppointmentsScreen from "../app/(app)/appointments"

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
          onPress: () =>
            props.onChange(
              { type: "set" },
              props.mode === "date"
                ? new Date(2026, 3, 24, 9, 0)
                : new Date(2026, 3, 24, 14, 30)
            )
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

jest.mock("../lib/diagnostics/service", () => ({
  captureDiagnosticsError: jest.fn(async () => {})
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
const { captureDiagnosticsError } = jest.requireMock("../lib/diagnostics/service") as {
  captureDiagnosticsError: jest.Mock
}
const { router } = jest.requireMock("expo-router") as {
  router: {
    push: jest.Mock
  }
}

describe("AppointmentsScreen", () => {
  let saveAppointment: jest.Mock
  let updateAppointmentStatus: jest.Mock
  let getAppointmentsInitialData: jest.Mock
  let listLeads: jest.Mock

  const eligibleLeads = [
    {
      id: "lead-1",
      agentId: "agent-1",
      buyerName: "Jordan Lane",
      buyerEmail: "jordan@example.com",
      buyerPhone: "416-555-0102",
      intakeType: "sale",
      token: "invite-token",
      tokenExpiresAt: "2026-04-27T00:00:00.000Z",
      status: "pending",
      pipelineStage: "ready_to_show",
      submittedAt: "2026-04-20T12:00:00.000Z",
      score: 8.2,
      recommendation: "show",
      summary: "Ready for a showing.",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z"
    },
    {
      id: "lead-2",
      agentId: "agent-1",
      buyerName: "Briar Stone",
      buyerEmail: "briar@example.com",
      buyerPhone: "416-555-0103",
      intakeType: "sale",
      token: "invite-token-2",
      tokenExpiresAt: "2026-04-27T00:00:00.000Z",
      status: "pending",
      pipelineStage: "nurture",
      submittedAt: "2026-04-20T12:00:00.000Z",
      score: 6.4,
      recommendation: "nurture",
      summary: "Needs a second conversation.",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z"
    },
    {
      id: "lead-3",
      agentId: "agent-1",
      buyerName: "Casey Ready",
      buyerEmail: "casey@example.com",
      buyerPhone: "416-555-0104",
      intakeType: "sale",
      token: "invite-token-3",
      tokenExpiresAt: "2026-04-27T00:00:00.000Z",
      status: "pending",
      pipelineStage: "ready_to_show",
      submittedAt: "2026-04-23T12:00:00.000Z",
      score: 8.7,
      recommendation: "show",
      summary: "Ready soon.",
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z"
    },
    {
      id: "lead-4",
      agentId: "agent-1",
      buyerName: "Morgan Ready",
      buyerEmail: "morgan@example.com",
      buyerPhone: "416-555-0105",
      intakeType: "sale",
      token: "invite-token-4",
      tokenExpiresAt: "2026-04-27T00:00:00.000Z",
      status: "pending",
      pipelineStage: "ready_to_show",
      submittedAt: "2026-04-22T12:00:00.000Z",
      score: 8.5,
      recommendation: "show",
      summary: "Ready this week.",
      createdAt: "2026-04-22T12:00:00.000Z",
      updatedAt: "2026-04-22T12:00:00.000Z"
    },
    {
      id: "lead-5",
      agentId: "agent-1",
      buyerName: "Rowan Ready",
      buyerEmail: "rowan@example.com",
      buyerPhone: "416-555-0106",
      intakeType: "sale",
      token: "invite-token-5",
      tokenExpiresAt: "2026-04-27T00:00:00.000Z",
      status: "pending",
      pipelineStage: "ready_to_show",
      submittedAt: "2026-04-19T12:00:00.000Z",
      score: 8.1,
      recommendation: "show",
      summary: "Older ready lead.",
      createdAt: "2026-04-19T12:00:00.000Z",
      updatedAt: "2026-04-19T12:00:00.000Z"
    },
    {
      id: "lead-6",
      agentId: "agent-1",
      buyerName: "Avery Hold",
      buyerEmail: "avery@example.com",
      buyerPhone: "416-555-0107",
      intakeType: "sale",
      token: "invite-token-6",
      tokenExpiresAt: "2026-04-27T00:00:00.000Z",
      status: "pending",
      pipelineStage: "hold",
      submittedAt: "2026-04-24T12:00:00.000Z",
      score: 5.9,
      recommendation: "hold",
      summary: "Can be searched, but not suggested.",
      createdAt: "2026-04-24T12:00:00.000Z",
      updatedAt: "2026-04-24T12:00:00.000Z"
    }
  ]

  beforeEach(() => {
    captureDiagnosticsError.mockClear()
    router.push.mockReset()
    useSession.mockReturnValue({
      session: {
        user: {
          id: "agent-1"
        }
      }
    })

    saveAppointment = jest.fn(async () => ({ ok: true }))
    updateAppointmentStatus = jest.fn(async () => ({ ok: true }))
    getAppointmentsInitialData = jest.fn(async () => ({
      appointments: {
        appointments: [],
        total: 0
      },
      eligibleLeads: eligibleLeads.slice(0, 3)
    }))
    listLeads = jest.fn(async () => ({
      leads: eligibleLeads,
      total: eligibleLeads.length
    }))

    useMobileApi.mockReturnValue({
      getAppointmentsInitialData,
      listAppointments: jest.fn(async () => ({
        appointments: [],
        total: 0
      })),
      listLeads,
      saveAppointment,
      updateAppointmentStatus
    })
  })

  it("opens a searchable schedule sheet with an explicit close action", async () => {
    const screen = render(<AppointmentsScreen />)

    await screen.findByTestId("appointments-open-schedule-sheet")
    expect(screen.getByText("Manage your showings and history.")).toBeTruthy()
    expect(
      screen.queryByText(
        "Keep scheduling and queue review separate so every appointment task is clear on a phone-sized screen."
      )
    ).toBeNull()
    expect(
      screen.queryByText(
        "Keep the main screen focused on the queue, then open scheduling only when you need it."
      )
    ).toBeNull()
    expect(screen.queryByTestId("appointment-save-button")).toBeNull()

    fireEvent.press(screen.getByTestId("appointments-open-schedule-sheet"))

    expect(await screen.findByTestId("appointment-save-button")).toBeTruthy()
    expect(screen.getByTestId("appointment-lead-search-input")).toBeTruthy()
    expect(screen.getByTestId("appointment-lead-search-input-keyboard-done")).toBeTruthy()
    expect(screen.getByTestId("appointments-schedule-sheet-close")).toBeTruthy()
    expect(
      screen.queryByText("Pick the lead first, then fill the minimal showing details.")
    ).toBeNull()
    expect(screen.queryByText("Use the local showing date.")).toBeNull()
    expect(screen.queryByText("Use the native clock to avoid manual typing.")).toBeNull()
    expect(
      screen.queryByText("Add the first stop only. Extra logistics can live in notes.")
    ).toBeNull()
    expect(screen.queryByText("Use this for lockbox or client timing notes.")).toBeNull()

    fireEvent.changeText(screen.getByTestId("appointment-lead-search-input"), "briar")

    await waitFor(() => {
      expect(screen.getByTestId("appointment-lead-option-lead-2")).toBeTruthy()
    })
    expect(listLeads).toHaveBeenCalledWith({
      scope: "appointment_eligible",
      query: "briar",
      limit: 10,
      offset: 0
    })
    expect(screen.queryByTestId("appointment-lead-option-lead-1")).toBeNull()

    fireEvent.changeText(screen.getByTestId("appointment-lead-search-input"), "missing")

    await waitFor(() => {
      expect(screen.getByText("No leads match this search")).toBeTruthy()
    })

    fireEvent.press(screen.getByTestId("appointment-clear-lead-search"))

    await waitFor(() => {
      expect(screen.getByTestId("appointment-lead-option-lead-1")).toBeTruthy()
    })

    fireEvent.press(screen.getByTestId("appointments-schedule-sheet-close"))

    await waitFor(() => {
      expect(screen.queryByTestId("appointment-save-button")).toBeNull()
    })
  })

  it("shows schedule validation inside the open sheet", async () => {
    const screen = render(<AppointmentsScreen />)

    fireEvent.press(await screen.findByTestId("appointments-open-schedule-sheet"))
    await screen.findByTestId("appointment-lead-option-lead-3")
    fireEvent.press(screen.getByTestId("appointment-save-button"))

    expect(screen.getByTestId("appointments-schedule-sheet-message")).toBeTruthy()
    expect(screen.getAllByText("Missing appointment details").length).toBeGreaterThan(0)
    expect(saveAppointment).not.toHaveBeenCalled()
  })

  it("logs appointment load errors without rendering technical details", async () => {
    const parseError = new Error(
      '[{"origin":"string","code":"invalid_format","message":"Start time must use HH:mm format."}]'
    )
    getAppointmentsInitialData.mockRejectedValueOnce(parseError)

    const screen = render(<AppointmentsScreen />)

    expect(await screen.findByText("Unable to load appointments")).toBeTruthy()
    expect(screen.getAllByText("Try again once the workspace reconnects.").length).toBeGreaterThan(0)
    expect(screen.queryByText(/invalid_format/)).toBeNull()
    expect(screen.queryByText(/Start time must use HH:mm format/)).toBeNull()
    expect(captureDiagnosticsError).toHaveBeenCalledWith(parseError, {
      eventType: "error.handled",
      category: "api",
      severity: "error",
      screen: "appointments",
      context: {
        action: "load-appointments",
        status: "scheduled"
      }
    })
  })

  it("starts with three recent ready leads and uses search for the full eligible list", async () => {
    const screen = render(<AppointmentsScreen />)

    fireEvent.press(await screen.findByTestId("appointments-open-schedule-sheet"))

    expect(getAppointmentsInitialData).toHaveBeenCalledWith({
      status: "scheduled",
      limit: 25,
      offset: 0,
      leadLimit: 3
    })
    expect(await screen.findByTestId("appointment-lead-option-lead-3")).toBeTruthy()
    expect(screen.getByTestId("appointment-lead-option-lead-4")).toBeTruthy()
    expect(screen.getByTestId("appointment-lead-option-lead-1")).toBeTruthy()
    expect(screen.queryByTestId("appointment-lead-option-lead-5")).toBeNull()
    expect(screen.queryByTestId("appointment-lead-option-lead-2")).toBeNull()
    expect(screen.queryByTestId("appointment-lead-option-lead-6")).toBeNull()

    fireEvent.changeText(screen.getByTestId("appointment-lead-search-input"), "rowan")

    await waitFor(() => {
      expect(screen.getByTestId("appointment-lead-option-lead-5")).toBeTruthy()
    })

    fireEvent.changeText(screen.getByTestId("appointment-lead-search-input"), "avery")

    await waitFor(() => {
      expect(screen.getByTestId("appointment-lead-option-lead-6")).toBeTruthy()
    })
  })

  it("uses native date and time pickers when saving an appointment", async () => {
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(jest.fn())
    const screen = render(<AppointmentsScreen />)

    fireEvent.press(await screen.findByTestId("appointments-open-schedule-sheet"))

    expect(screen.queryByTestId("appointment-date-input")).toBeNull()
    expect(screen.queryByTestId("appointment-start-time-input")).toBeNull()

    fireEvent.changeText(screen.getByTestId("appointment-lead-search-input"), "jordan")
    fireEvent.press(screen.getByTestId("appointment-lead-option-lead-1"))
    expect(dismissSpy).toHaveBeenCalled()
    expect(screen.getByTestId("appointment-lead-option-lead-1").props.accessibilityState).toEqual({
      selected: true
    })

    fireEvent.press(screen.getByTestId("appointment-open-date-picker"))
    fireEvent.press(screen.getByTestId("appointment-native-date-picker"))

    fireEvent.press(screen.getByTestId("appointment-open-time-picker"))
    fireEvent.press(screen.getByTestId("appointment-native-time-picker"))

    fireEvent.changeText(screen.getByTestId("appointment-address-input"), "123 Queen St W, Toronto")
    fireEvent.changeText(screen.getByTestId("appointment-notes-input"), "Use the side entrance.")
    fireEvent.press(screen.getByTestId("appointment-save-button"))

    await waitFor(() => {
      expect(saveAppointment).toHaveBeenCalledWith({
        leadId: "lead-1",
        date: "2026-04-24",
        startTime: "14:30",
        notes: "Use the side entrance.",
        showings: [{ address: "123 Queen St W, Toronto" }]
      })
    })
    dismissSpy.mockRestore()
  })

  it("uses visible picker defaults when iOS pickers are opened and closed unchanged", async () => {
    const screen = render(<AppointmentsScreen />)

    fireEvent.press(await screen.findByTestId("appointments-open-schedule-sheet"))
    fireEvent.press(screen.getByTestId("appointment-lead-option-lead-1"))

    fireEvent.press(screen.getByTestId("appointment-open-date-picker"))
    fireEvent.press(screen.getByTestId("appointment-close-date-picker"))
    fireEvent.press(screen.getByTestId("appointment-open-time-picker"))
    fireEvent.press(screen.getByTestId("appointment-close-time-picker"))

    fireEvent.changeText(screen.getByTestId("appointment-address-input"), "123 Queen St W, Toronto")
    fireEvent.press(screen.getByTestId("appointment-save-button"))

    await waitFor(() => {
      expect(saveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "lead-1",
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          startTime: expect.stringMatching(/^\d{2}:\d{2}$/),
          showings: [{ address: "123 Queen St W, Toronto" }]
        })
      )
    })
  })

  it("initializes appointment date and time when a lead is selected", async () => {
    const screen = render(<AppointmentsScreen />)

    fireEvent.press(await screen.findByTestId("appointments-open-schedule-sheet"))
    fireEvent.press(screen.getByTestId("appointment-lead-option-lead-1"))
    fireEvent.changeText(screen.getByTestId("appointment-address-input"), "123 Queen St W, Toronto")
    fireEvent.press(screen.getByTestId("appointment-save-button"))

    await waitFor(() => {
      expect(saveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "lead-1",
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          startTime: expect.stringMatching(/^\d{2}:\d{2}$/),
          showings: [{ address: "123 Queen St W, Toronto" }]
        })
      )
    })
  })

  it("marks scheduled appointments complete through a stable lead action id", async () => {
    getAppointmentsInitialData.mockResolvedValueOnce({
      appointments: {
        appointments: [
          {
            id: "appointment-1",
            leadId: "lead-1",
            date: "2026-04-24",
            startTime: "14:30",
            status: "scheduled",
            notes: "Use the side entrance.",
            createdAt: "2026-04-20T12:00:00.000Z",
            lead: {
              id: "lead-1",
              buyerName: "Jordan Lane",
              buyerEmail: "jordan@example.com",
              buyerPhone: "416-555-0102",
              pipelineStage: "ready_to_show"
            },
            showings: [
              {
                id: "showing-1",
                appointmentId: "appointment-1",
                address: "123 Queen St W, Toronto",
                orderIndex: 0
              }
            ]
          }
        ],
        total: 1
      },
      eligibleLeads: eligibleLeads.slice(0, 3)
    })
    const screen = render(<AppointmentsScreen />)

    fireEvent.press(await screen.findByTestId("appointment-complete-lead-lead-1"))

    await waitFor(() => {
      expect(updateAppointmentStatus).toHaveBeenCalledWith("appointment-1", "completed")
      expect(screen.getByText("Appointment updated")).toBeTruthy()
      expect(getAppointmentsInitialData).toHaveBeenCalledWith({
        status: "completed",
        limit: 25,
        offset: 0,
        leadLimit: 3
      })
    })
  })

  it("opens settings from the appointments header", async () => {
    const screen = render(<AppointmentsScreen />)

    fireEvent.press(await screen.findByTestId("appointments-settings-button"))

    expect(router.push).toHaveBeenCalledWith("/settings")
  })
})
