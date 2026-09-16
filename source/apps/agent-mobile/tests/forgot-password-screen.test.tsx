import { fireEvent, render, waitFor } from "@testing-library/react-native"
import ForgotPasswordScreen from "../app/(auth)/forgot-password"

const mockRequestPasswordResetEmail = jest.fn()
const mockRouterBack = jest.fn()
const mockUseLocalSearchParams = jest.fn()

jest.mock("../lib/auth-password", () => ({
  requestPasswordResetEmail: (...args: unknown[]) => mockRequestPasswordResetEmail(...args)
}))

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockRouterBack(...args)
  },
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args)
}))

describe("ForgotPasswordScreen", () => {
  beforeEach(() => {
    mockRequestPasswordResetEmail.mockReset()
    mockRequestPasswordResetEmail.mockResolvedValue({ type: "success" })
    mockRouterBack.mockReset()
    mockUseLocalSearchParams.mockReset()
    mockUseLocalSearchParams.mockReturnValue({})
  })

  it("prefills the email from sign-in navigation params", () => {
    mockUseLocalSearchParams.mockReturnValue({ email: "agent@example.com" })

    const screen = render(<ForgotPasswordScreen />)

    expect(screen.getByTestId("forgot-password-email-input").props.value).toBe(
      "agent@example.com"
    )
  })

  it("requires an email before sending a reset request", () => {
    const screen = render(<ForgotPasswordScreen />)

    fireEvent.press(screen.getByTestId("send-password-reset-button"))

    expect(screen.getByText("Enter your email address.")).toBeTruthy()
    expect(mockRequestPasswordResetEmail).not.toHaveBeenCalled()
  })

  it("sends the reset request and shows generic success feedback", async () => {
    const screen = render(<ForgotPasswordScreen />)

    fireEvent.changeText(screen.getByTestId("forgot-password-email-input"), "agent@example.com")
    fireEvent.press(screen.getByTestId("send-password-reset-button"))

    await waitFor(() => {
      expect(mockRequestPasswordResetEmail).toHaveBeenCalledWith("agent@example.com")
    })
    expect(
      screen.getByText("If an account exists for that email, we sent a password reset link.")
    ).toBeTruthy()
  })

  it("shows Supabase errors from the reset request", async () => {
    mockRequestPasswordResetEmail.mockResolvedValue({
      type: "error",
      message: "Email rate limit exceeded."
    })

    const screen = render(<ForgotPasswordScreen />)

    fireEvent.changeText(screen.getByTestId("forgot-password-email-input"), "agent@example.com")
    fireEvent.press(screen.getByTestId("send-password-reset-button"))

    expect(await screen.findByText("Email rate limit exceeded.")).toBeTruthy()
  })
})
