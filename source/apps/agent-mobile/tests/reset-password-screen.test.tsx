import { fireEvent, render, waitFor } from "@testing-library/react-native"
import ResetPasswordScreen from "../app/reset-password"

const mockUseSession = jest.fn()
const mockUpdateRecoveredPassword = jest.fn()
const mockRouterReplace = jest.fn()

jest.mock("../providers/session-provider", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args)
}))

jest.mock("../lib/auth-password", () => ({
  updateRecoveredPassword: (...args: unknown[]) => mockUpdateRecoveredPassword(...args)
}))

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args)
  }
}))

describe("ResetPasswordScreen", () => {
  beforeEach(() => {
    mockUseSession.mockReset()
    mockUseSession.mockReturnValue({
      passwordRecoveryPending: true,
      clearPasswordRecovery: jest.fn()
    })
    mockUpdateRecoveredPassword.mockReset()
    mockUpdateRecoveredPassword.mockResolvedValue({ type: "success" })
    mockRouterReplace.mockReset()
  })

  it("shows an invalid-link state when no recovery session is pending", () => {
    mockUseSession.mockReturnValue({
      passwordRecoveryPending: false,
      clearPasswordRecovery: jest.fn()
    })

    const screen = render(<ResetPasswordScreen />)

    expect(screen.getByText("This password reset link is invalid or expired.")).toBeTruthy()

    fireEvent.press(screen.getByTestId("reset-password-invalid-sign-in-button"))

    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/(auth)/sign-in",
      params: {
        reset: "invalid"
      }
    })
  })

  it("requires matching password fields", () => {
    const screen = render(<ResetPasswordScreen />)

    fireEvent.changeText(screen.getByTestId("new-password-input"), "new-password")
    fireEvent.changeText(screen.getByTestId("confirm-password-input"), "different-password")
    fireEvent.press(screen.getByTestId("update-password-button"))

    expect(screen.getByText("Passwords do not match.")).toBeTruthy()
    expect(mockUpdateRecoveredPassword).not.toHaveBeenCalled()
  })

  it("updates the password, clears recovery state, and returns to sign-in", async () => {
    const clearPasswordRecovery = jest.fn()
    mockUseSession.mockReturnValue({
      passwordRecoveryPending: true,
      clearPasswordRecovery
    })

    const screen = render(<ResetPasswordScreen />)

    fireEvent.changeText(screen.getByTestId("new-password-input"), "new-secure-password")
    fireEvent.changeText(screen.getByTestId("confirm-password-input"), "new-secure-password")
    fireEvent.press(screen.getByTestId("update-password-button"))

    await waitFor(() => {
      expect(mockUpdateRecoveredPassword).toHaveBeenCalledWith("new-secure-password")
    })
    expect(clearPasswordRecovery).toHaveBeenCalledTimes(1)
    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/(auth)/sign-in",
      params: {
        reset: "success"
      }
    })
  })

  it("shows password update errors", async () => {
    mockUpdateRecoveredPassword.mockResolvedValue({
      type: "error",
      message: "Password should be at least 6 characters."
    })

    const screen = render(<ResetPasswordScreen />)

    fireEvent.changeText(screen.getByTestId("new-password-input"), "short")
    fireEvent.changeText(screen.getByTestId("confirm-password-input"), "short")
    fireEvent.press(screen.getByTestId("update-password-button"))

    expect(await screen.findByText("Password should be at least 6 characters.")).toBeTruthy()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })
})
