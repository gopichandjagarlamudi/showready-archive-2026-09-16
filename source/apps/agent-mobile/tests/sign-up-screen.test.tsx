import { fireEvent, render, waitFor } from "@testing-library/react-native"
import SignUpScreen from "../app/(auth)/sign-up"

const mockRouterBack = jest.fn()
const mockUseLocalSearchParams = jest.fn()

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockRouterBack(...args)
  },
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args)
}))

jest.mock("../lib/diagnostics/service", () => ({
  captureDiagnosticsError: jest.fn(async () => undefined)
}))

jest.mock("../lib/auth-oauth", () => ({
  getMobileAuthBridgeUrl: jest.fn(() => "https://showready.example/auth/mobile-callback")
}))

jest.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(async () => ({
        data: {
          session: null,
          user: { id: "agent-1" }
        },
        error: null
      }))
    }
  }
}))

const { captureDiagnosticsError } = jest.requireMock("../lib/diagnostics/service") as {
  captureDiagnosticsError: jest.Mock
}

const { supabase } = jest.requireMock("../lib/supabase") as {
  supabase: {
    auth: {
      signUp: jest.Mock
    }
  }
}

describe("SignUpScreen", () => {
  beforeEach(() => {
    mockRouterBack.mockReset()
    mockUseLocalSearchParams.mockReset()
    mockUseLocalSearchParams.mockReturnValue({})
    captureDiagnosticsError.mockReset()
    supabase.auth.signUp.mockReset()
    supabase.auth.signUp.mockResolvedValue({
      data: {
        session: null,
        user: { id: "agent-1" }
      },
      error: null
    })
  })

  it("prefills the email from sign-in navigation params", () => {
    mockUseLocalSearchParams.mockReturnValue({ email: "agent@example.com" })

    const screen = render(<SignUpScreen />)

    expect(screen.getByTestId("sign-up-email-input").props.value).toBe("agent@example.com")
  })

  it("requires profile and password fields before creating an account", () => {
    const screen = render(<SignUpScreen />)

    fireEvent.press(screen.getByTestId("create-account-button"))

    expect(screen.getByText("Enter your full name.")).toBeTruthy()
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it("requires matching passwords", () => {
    const screen = render(<SignUpScreen />)

    fireEvent.changeText(screen.getByTestId("sign-up-full-name-input"), "Alex Agent")
    fireEvent.changeText(screen.getByTestId("sign-up-email-input"), "agent@example.com")
    fireEvent.changeText(screen.getByTestId("sign-up-password-input"), "password-one")
    fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), "password-two")
    fireEvent.press(screen.getByTestId("create-account-button"))

    expect(screen.getByText("Passwords do not match.")).toBeTruthy()
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it("creates an account with normalized profile metadata", async () => {
    const screen = render(<SignUpScreen />)

    fireEvent.changeText(screen.getByTestId("sign-up-full-name-input"), " Alex Agent ")
    fireEvent.changeText(screen.getByTestId("sign-up-email-input"), " AGENT@EXAMPLE.COM ")
    fireEvent.changeText(screen.getByTestId("sign-up-password-input"), "password-one")
    fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), "password-one")
    fireEvent.press(screen.getByTestId("create-account-button"))

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "agent@example.com",
        password: "password-one",
        options: {
          emailRedirectTo: "https://showready.example/auth/mobile-callback",
          data: {
            full_name: "Alex Agent"
          }
        }
      })
    })
    expect(
      screen.getByText("Check your email to confirm your account, then sign in.")
    ).toBeTruthy()
  })

  it("shows friendly feedback when account creation fails", async () => {
    const signUpError = new Error("Email rate limit exceeded.")
    supabase.auth.signUp.mockResolvedValue({
      data: {
        session: null,
        user: null
      },
      error: signUpError
    })

    const screen = render(<SignUpScreen />)

    fireEvent.changeText(screen.getByTestId("sign-up-full-name-input"), "Alex Agent")
    fireEvent.changeText(screen.getByTestId("sign-up-email-input"), "agent@example.com")
    fireEvent.changeText(screen.getByTestId("sign-up-password-input"), "password-one")
    fireEvent.changeText(screen.getByTestId("sign-up-confirm-password-input"), "password-one")
    fireEvent.press(screen.getByTestId("create-account-button"))

    expect(await screen.findByText("Email rate limit exceeded.")).toBeTruthy()
    expect(captureDiagnosticsError).toHaveBeenCalledWith(signUpError, {
      eventType: "auth.event",
      category: "auth",
      severity: "error",
      context: {
        method: "password-sign-up"
      }
    })
  })
})
