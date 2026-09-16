import { render } from "@testing-library/react-native"
import AuthLayout from "../app/(auth)/_layout"

jest.mock("../providers/session-provider", () => ({
  useSession: jest.fn()
}))

jest.mock("expo-router", () => {
  const { Text } = require("react-native")

  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect-target">{href}</Text>,
    Stack: () => <Text testID="auth-stack">auth-stack</Text>
  }
})

const { useSession } = jest.requireMock("../providers/session-provider") as {
  useSession: jest.Mock
}

describe("AuthLayout", () => {
  it("redirects authenticated users into the app shell", () => {
    useSession.mockReturnValue({
      session: { user: { id: "agent-1" } },
      isBootstrapping: false,
      passwordRecoveryPending: false
    })

    const screen = render(<AuthLayout />)

    expect(screen.getByTestId("redirect-target").props.children).toBe("/(app)/home")
  })

  it("renders auth routes while bootstrapping or signed out", () => {
    useSession.mockReturnValue({
      session: null,
      isBootstrapping: false,
      passwordRecoveryPending: false
    })

    const screen = render(<AuthLayout />)

    expect(screen.getByTestId("auth-stack")).toBeTruthy()
  })

  it("keeps auth routes available during password recovery", () => {
    useSession.mockReturnValue({
      session: { user: { id: "agent-1" } },
      isBootstrapping: false,
      passwordRecoveryPending: true
    })

    const screen = render(<AuthLayout />)

    expect(screen.getByTestId("auth-stack")).toBeTruthy()
  })
})
