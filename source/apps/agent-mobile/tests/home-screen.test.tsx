import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import HomeScreen from "../app/(app)/home"

jest.mock("../providers/session-provider", () => ({
  useSession: jest.fn(),
  useMobileApi: jest.fn()
}))

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn()
  }
}))

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn()
}))

const mockShare = jest.fn()

jest.mock("react-native/Libraries/Share/Share", () => ({
  share: (...args: unknown[]) => mockShare(...args)
}))

const { useSession, useMobileApi } = jest.requireMock("../providers/session-provider") as {
  useSession: jest.Mock
  useMobileApi: jest.Mock
}

const { setStringAsync } = jest.requireMock("expo-clipboard") as {
  setStringAsync: jest.Mock
}
const { router } = jest.requireMock("expo-router") as {
  router: {
    push: jest.Mock
  }
}

describe("HomeScreen", () => {
  beforeEach(() => {
    mockShare.mockReset()
    setStringAsync.mockReset()
    router.push.mockReset()
    useSession.mockReturnValue({
      session: {
        user: {
          id: "agent-1",
          user_metadata: {
            full_name: "Session Name"
          }
        }
      }
    })
    useMobileApi.mockReturnValue({
      getHomeData: jest.fn(async () => ({
        summary: {
          totalLeads: 12,
          readyToShow: 2,
          appointmentBooked: 1,
          newLeads: 3,
          nurture: 4,
          hold: 3,
          averageScore: 7.2
        },
        recentLeads: []
      })),
      createInvite: jest.fn(async () => ({
        token: "invite-token",
        shareUrl: "https://showready.example.com/intake/invite-token",
        expiresAt: "2026-04-27T12:00:00.000Z",
        agentName: "Jonathan"
      }))
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("shows the generated invite link and copies it from the dashboard", async () => {
    const screen = render(<HomeScreen />)

    expect(
      screen.queryByText(
        "One mobile command center for invite creation, live pipeline health, and fast access to the leads that need action first."
      )
    ).toBeNull()
    await screen.findByTestId("invite-sheet-open-button")
    expect(
      screen.queryByText("The four most recent submissions stay within thumb reach.")
    ).toBeNull()

    fireEvent.press(screen.getByTestId("invite-sheet-open-button"))
    expect(
      screen.queryByText("Generate and hand off intake links without crowding the dashboard.")
    ).toBeNull()
    expect(screen.queryByText("Create a fresh intake link")).toBeNull()
    expect(
      screen.queryByText(
        "Hand it to a lead now, then copy or share the generated URL from this same sheet."
      )
    ).toBeNull()
    fireEvent.press(await screen.findByText("Create invite"))

    await screen.findByText("https://showready.example.com/intake/invite-token")
    expect(screen.getByTestId("copy-invite-button")).toBeTruthy()
    expect(mockShare).not.toHaveBeenCalled()

    fireEvent.press(screen.getByTestId("copy-invite-button"))

    await waitFor(() => {
      expect(setStringAsync).toHaveBeenCalledWith(
        "Jonathan has invited you to complete your ShowReady intake form. Please submit your information here: https://showready.example.com/intake/invite-token"
      )
    })
  })

  it("confirms copied invite links on the copy button before resetting", async () => {
    const screen = render(<HomeScreen />)

    fireEvent.press(await screen.findByTestId("invite-sheet-open-button"))
    fireEvent.press(await screen.findByText("Create invite"))

    await screen.findByText("https://showready.example.com/intake/invite-token")
    expect(screen.getByText("Copy link")).toBeTruthy()

    jest.useFakeTimers()
    fireEvent.press(screen.getByTestId("copy-invite-button"))

    await waitFor(() => {
      expect(setStringAsync).toHaveBeenCalledWith(
        "Jonathan has invited you to complete your ShowReady intake form. Please submit your information here: https://showready.example.com/intake/invite-token"
      )
    })
    expect(await screen.findByText("Copied to clipboard")).toBeTruthy()
    expect(screen.queryByText("Copy link")).toBeNull()

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(screen.getByText("Copy link")).toBeTruthy()
    })
    expect(screen.queryByText("Copied to clipboard")).toBeNull()
  })

  it("opens invite tools with the create action immediately available", async () => {
    const screen = render(<HomeScreen />)

    fireEvent.press(await screen.findByTestId("invite-sheet-open-button"))

    expect(await screen.findByTestId("invite-button")).toBeTruthy()
    expect(screen.queryByText("No link yet")).toBeNull()
  })

  it("routes from the dashboard metric tiles to their work areas", async () => {
    const screen = render(<HomeScreen />)

    const metricRail = await screen.findByTestId("home-metric-rail")
    expect(metricRail.props.horizontal).toBe(true)

    fireEvent.press(await screen.findByTestId("home-metric-ready"))
    expect(router.push).toHaveBeenCalledWith("/pipeline")

    fireEvent.press(screen.getByTestId("home-metric-booked"))
    expect(router.push).toHaveBeenCalledWith("/appointments")

    expect(screen.queryByTestId("home-metric-hold")).toBeNull()
    expect(screen.getByTestId("home-recent-view-all")).toBeTruthy()
  })

  it("uses an inline recent-activity empty state instead of nesting cards", async () => {
    const screen = render(<HomeScreen />)

    expect(await screen.findByTestId("home-recent-empty")).toBeTruthy()
    expect(screen.queryByText("First run")).toBeNull()
  })

  it("loads dashboard data through the consolidated home endpoint", async () => {
    const screen = render(<HomeScreen />)

    await screen.findByTestId("home-recent-empty")

    const api = useMobileApi.mock.results[0]?.value
    expect(api.getHomeData).toHaveBeenCalledTimes(1)
  })

  it("opens settings from the dashboard header", async () => {
    const screen = render(<HomeScreen />)

    fireEvent.press(await screen.findByTestId("home-settings-button"))

    expect(router.push).toHaveBeenCalledWith("/settings")
  })
})
