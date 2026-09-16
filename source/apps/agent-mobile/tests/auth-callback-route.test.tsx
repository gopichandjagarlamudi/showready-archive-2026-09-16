import { render, waitFor } from "@testing-library/react-native"
import AuthCallbackRoute, {
  buildAuthCallbackUrlFromParams
} from "../app/auth/callback"

const mockUseLocalSearchParams = jest.fn()
const mockUseSession = jest.fn()

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const React = require("react")
    const { Text } = require("react-native")

    return React.createElement(Text, { testID: "redirect-target" }, href)
  },
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args)
}))

jest.mock("../components/loading-screen", () => ({
  LoadingScreen: () => {
    const React = require("react")
    const { Text } = require("react-native")

    return React.createElement(Text, { testID: "loading-screen" }, "Loading")
  }
}))

jest.mock("../providers/session-provider", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args)
}))

describe("AuthCallbackRoute", () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReset()
    mockUseSession.mockReset()
    mockUseLocalSearchParams.mockReturnValue({})
    mockUseSession.mockReturnValue({
      session: null,
      isBootstrapping: false,
      passwordRecoveryPending: false,
      restoreAuthCallbackUrl: jest.fn(async () => undefined)
    })
  })

  it("builds a native auth callback URL from route params", () => {
    expect(
      buildAuthCallbackUrlFromParams({
        access_token: "access token",
        refresh_token: "refresh-token",
        type: "recovery"
      })
    ).toBe(
      "showready://auth/callback?access_token=access+token&refresh_token=refresh-token&type=recovery"
    )
  })

  it("restores the callback URL through the session provider", async () => {
    const restoreAuthCallbackUrl = jest.fn(async () => undefined)
    mockUseLocalSearchParams.mockReturnValue({
      access_token: "access",
      refresh_token: "refresh"
    })
    mockUseSession.mockReturnValue({
      session: null,
      isBootstrapping: false,
      passwordRecoveryPending: false,
      restoreAuthCallbackUrl
    })

    render(<AuthCallbackRoute />)

    await waitFor(() => {
      expect(restoreAuthCallbackUrl).toHaveBeenCalledWith(
        "showready://auth/callback?access_token=access&refresh_token=refresh"
      )
    })
  })

  it("does not invoke restoration when the callback has no params", async () => {
    const restoreAuthCallbackUrl = jest.fn(async () => undefined)
    mockUseSession.mockReturnValue({
      session: null,
      isBootstrapping: false,
      passwordRecoveryPending: false,
      restoreAuthCallbackUrl
    })

    const screen = render(<AuthCallbackRoute />)

    await waitFor(() => {
      expect(screen.getByTestId("redirect-target").props.children).toBe("/(auth)/sign-in")
    })
    expect(restoreAuthCallbackUrl).not.toHaveBeenCalled()
  })
})
