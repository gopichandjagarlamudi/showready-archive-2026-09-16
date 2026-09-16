import { render } from "@testing-library/react-native"
import IndexRoute from "../app/index"

jest.mock("../providers/session-provider", () => ({
  useSession: jest.fn()
}))

jest.mock("expo-router", () => {
  const { Text } = require("react-native")

  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect-target">{href}</Text>
  }
})

jest.mock("../components/loading-screen", () => ({
  LoadingScreen: () => {
    const { Text } = require("react-native")

    return <Text testID="loading-screen">loading</Text>
  }
}))

const { useSession } = jest.requireMock("../providers/session-provider") as {
  useSession: jest.Mock
}

describe("IndexRoute", () => {
  it("routes recovery sessions to password reset instead of the app shell", () => {
    useSession.mockReturnValue({
      session: { user: { id: "agent-1" } },
      isBootstrapping: false,
      passwordRecoveryPending: true
    })

    const screen = render(<IndexRoute />)

    expect(screen.getByTestId("redirect-target").props.children).toBe("/reset-password")
  })
})
