import { fireEvent, render, waitFor } from "@testing-library/react-native"
import SettingsScreen from "../app/(app)/settings"

jest.mock("../providers/session-provider", () => ({
  useSession: jest.fn(),
  useMobileApi: jest.fn()
}))

jest.mock("../lib/share-csv", () => ({
  shareCsvFile: jest.fn(async () => undefined)
}))

jest.mock("expo-linking", () => ({
  openURL: jest.fn(async () => true)
}))

const { useSession, useMobileApi } = jest.requireMock("../providers/session-provider") as {
  useSession: jest.Mock
  useMobileApi: jest.Mock
}
const { shareCsvFile } = jest.requireMock("../lib/share-csv") as {
  shareCsvFile: jest.Mock
}
const Linking = jest.requireMock("expo-linking") as {
  openURL: jest.Mock
}

describe("SettingsScreen", () => {
  let saveSettings: jest.Mock
  let submitFeedback: jest.Mock
  let exportLeadsCsv: jest.Mock
  let requestAccountDeletion: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://app.showready.test"
    process.env.EXPO_PUBLIC_SITE_URL = "https://app.showready.test"
    jest.setSystemTime(new Date("2026-05-04T12:00:00.000Z"))
    saveSettings = jest.fn(async () => undefined)
    submitFeedback = jest.fn(async () => ({ ok: true }))
    exportLeadsCsv = jest.fn(async () => ({
      fileName: "showready-leads-2026-05-01-to-2026-05-04.csv",
      csv: "First Name,Email\nRiley,riley@example.com\n",
      rowCount: 1
    }))
    requestAccountDeletion = jest.fn(async () => ({
      ok: true,
      requestId: "privacy-request-1"
    }))
    shareCsvFile.mockClear()
    Linking.openURL.mockReset()
    Linking.openURL.mockResolvedValue(true)
    useSession.mockReturnValue({
      session: {
        user: {
          id: "agent-1",
          email: "agent@example.com"
        }
      },
      signOut: jest.fn(async () => undefined)
    })

    useMobileApi.mockReturnValue({
      getSettings: jest.fn(async () => ({
        fullName: "Demo Agent",
        brokerage: "Northline Realty",
        licenseNumber: "SR-2026-001",
        emailNotificationsEnabled: false
      })),
      saveSettings,
      submitFeedback,
      exportLeadsCsv,
      requestAccountDeletion
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("shows a sign out button and calls sign out when pressed", async () => {
    const signOut = jest.fn(async () => undefined)

    useSession.mockReturnValue({
      session: {
        user: {
          id: "agent-1",
          email: "agent@example.com"
        }
      },
      signOut
    })

    const screen = render(<SettingsScreen />)

    expect(await screen.findByTestId("settings-sign-out-button")).toBeTruthy()

    fireEvent.press(screen.getByTestId("settings-sign-out-button"))

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Sign out")).toBeTruthy()
    })
  })

  it("shows an email notification toggle and saves it", async () => {
    const screen = render(<SettingsScreen />)

    await screen.findByTestId("settings-save-button")

    expect(screen.getByText("Also send email notification")).toBeTruthy()
    expect(
      screen.queryByText(
        "Keep your mobile profile clean and accurate without carrying the full desktop admin surface."
      )
    ).toBeNull()
    expect(screen.queryByText("Signed in identity")).toBeNull()
    expect(
      screen.queryByText("Profile updates stay scoped to this signed-in account.")
    ).toBeNull()
    expect(screen.queryByText("Profile maintenance")).toBeNull()
    expect(
      screen.queryByText(
        "Send an email copy when a new lead submits the generated intake form."
      )
    ).toBeNull()

    fireEvent(screen.getByTestId("settings-email-notifications-toggle"), "valueChange", true)
    fireEvent.press(screen.getByTestId("settings-save-button"))

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({
        fullName: "Demo Agent",
        brokerage: "Northline Realty",
        licenseNumber: "SR-2026-001",
        emailNotificationsEnabled: true
      })
    })
  })

  it("submits feedback from settings and clears the message", async () => {
    const screen = render(<SettingsScreen />)

    await screen.findByTestId("settings-save-button")

    fireEvent.changeText(
      screen.getByTestId("settings-feedback-input"),
      "  Please add calendar sync for showings.  "
    )
    fireEvent.press(screen.getByTestId("settings-feedback-submit-button"))

    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith({
        message: "Please add calendar sync for showings."
      })
      expect(screen.getByText("Feedback sent")).toBeTruthy()
      expect(screen.getByTestId("settings-feedback-input").props.value).toBe("")
    })
  })

  it("requires feedback before submitting", async () => {
    const screen = render(<SettingsScreen />)

    await screen.findByTestId("settings-save-button")

    fireEvent.changeText(screen.getByTestId("settings-feedback-input"), "   ")
    fireEvent.press(screen.getByTestId("settings-feedback-submit-button"))

    await waitFor(() => {
      expect(submitFeedback).not.toHaveBeenCalled()
      expect(screen.getByText("Feedback required")).toBeTruthy()
    })
  })

  it("exports lead data from settings and shares the returned CSV file", async () => {
    const screen = render(<SettingsScreen />)

    await screen.findByTestId("settings-save-button")

    fireEvent.press(screen.getByTestId("settings-open-export-sheet-button"))

    expect(await screen.findByTestId("settings-export-sheet")).toBeTruthy()

    fireEvent.press(screen.getByTestId("settings-export-open-from-date-picker"))
    fireEvent(
      screen.getByTestId("settings-export-native-from-date-picker"),
      "onChange",
      {
        type: "set",
        nativeEvent: {
          timestamp: new Date("2026-05-01T12:00:00.000Z").getTime()
        }
      },
      new Date("2026-05-01T12:00:00.000Z")
    )
    fireEvent.press(screen.getByTestId("settings-export-open-to-date-picker"))
    fireEvent(
      screen.getByTestId("settings-export-native-to-date-picker"),
      "onChange",
      {
        type: "set",
        nativeEvent: {
          timestamp: new Date("2026-05-04T12:00:00.000Z").getTime()
        }
      },
      new Date("2026-05-04T12:00:00.000Z")
    )

    fireEvent.press(screen.getByTestId("settings-export-submit-button"))

    await waitFor(() => {
      expect(exportLeadsCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          fromDate: "2026-05-01",
          toDate: "2026-05-04",
          timeZone: expect.any(String)
        })
      )
      expect(shareCsvFile).toHaveBeenCalledWith({
        fileName: "showready-leads-2026-05-01-to-2026-05-04.csv",
        csv: "First Name,Email\nRiley,riley@example.com\n"
      })
      expect(screen.getByText("CSV ready")).toBeTruthy()
    })
  })

  it("opens privacy and legal resources from settings", async () => {
    const screen = render(<SettingsScreen />)

    await screen.findByTestId("settings-save-button")

    expect(screen.getByText("Privacy & Legal")).toBeTruthy()
    expect(screen.getByText(/lead and client contact details/i)).toBeTruthy()

    fireEvent.press(screen.getByTestId("settings-open-privacy-policy-button"))
    fireEvent.press(screen.getByTestId("settings-open-terms-button"))
    fireEvent.press(screen.getByTestId("settings-open-support-button"))
    fireEvent.press(screen.getByTestId("settings-open-account-deletion-web-button"))

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("https://app.showready.test/privacy")
      expect(Linking.openURL).toHaveBeenCalledWith("https://app.showready.test/terms")
      expect(Linking.openURL).toHaveBeenCalledWith("https://app.showready.test/support")
      expect(Linking.openURL).toHaveBeenCalledWith(
        "https://app.showready.test/account-deletion"
      )
    })
  })

  it("blocks export when the from date is after the to date", async () => {
    const screen = render(<SettingsScreen />)

    await screen.findByTestId("settings-save-button")

    fireEvent.press(screen.getByTestId("settings-open-export-sheet-button"))
    fireEvent.press(await screen.findByTestId("settings-export-open-from-date-picker"))
    fireEvent(
      screen.getByTestId("settings-export-native-from-date-picker"),
      "onChange",
      {
        type: "set",
        nativeEvent: {
          timestamp: new Date("2026-05-05T12:00:00.000Z").getTime()
        }
      },
      new Date("2026-05-05T12:00:00.000Z")
    )
    fireEvent.press(screen.getByTestId("settings-export-open-to-date-picker"))
    fireEvent(
      screen.getByTestId("settings-export-native-to-date-picker"),
      "onChange",
      {
        type: "set",
        nativeEvent: {
          timestamp: new Date("2026-05-04T12:00:00.000Z").getTime()
        }
      },
      new Date("2026-05-04T12:00:00.000Z")
    )
    fireEvent.press(screen.getByTestId("settings-export-submit-button"))

    await waitFor(() => {
      expect(exportLeadsCsv).not.toHaveBeenCalled()
      expect(screen.getByText("Date range invalid")).toBeTruthy()
    })
  })
})
