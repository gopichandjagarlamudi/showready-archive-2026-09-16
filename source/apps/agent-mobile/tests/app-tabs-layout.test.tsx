import { render } from "@testing-library/react-native"
import AppTabsLayout from "../app/(app)/_layout"

const screenCalls: Array<{ name: string; options?: Record<string, unknown> }> = []
const tabsCalls: Array<{ screenOptions?: Record<string, unknown> }> = []

jest.mock("../providers/session-provider", () => ({
  useSession: jest.fn()
}))

jest.mock("expo-router", () => {
  const React = require("react")
  const { Text, View } = require("react-native")

  function Tabs(props: { children?: React.ReactNode; screenOptions?: Record<string, unknown> }) {
    tabsCalls.push(props)
    return <View>{props.children}</View>
  }

  Tabs.Screen = (props: { name: string; options?: Record<string, unknown> }) => {
    screenCalls.push(props)
    return null
  }

  function Redirect(props: { href: string }) {
    return <Text testID="redirect-target">{props.href}</Text>
  }

  return { Tabs, Redirect }
})

const { useSession } = jest.requireMock("../providers/session-provider") as {
  useSession: jest.Mock
}

describe("AppTabsLayout", () => {
  beforeEach(() => {
    screenCalls.length = 0
    tabsCalls.length = 0
  })

  it("redirects signed-out users back to sign in", () => {
    useSession.mockReturnValue({
      session: null,
      isBootstrapping: false,
      passwordRecoveryPending: false
    })

    const screen = render(<AppTabsLayout />)

    expect(screen.getByTestId("redirect-target").props.children).toBe("/(auth)/sign-in")
  })

  it("redirects recovery sessions to the reset password screen", () => {
    useSession.mockReturnValue({
      session: { user: { id: "agent-1" } },
      isBootstrapping: false,
      passwordRecoveryPending: true,
      unreadNewLeadsCount: 0
    })

    const screen = render(<AppTabsLayout />)

    expect(screen.getByTestId("redirect-target").props.children).toBe("/reset-password")
  })

  it("keeps the bottom navigation to four primary destinations and hides settings", () => {
    useSession.mockReturnValue({
      session: { user: { id: "agent-1" } },
      isBootstrapping: false,
      passwordRecoveryPending: false,
      unreadNewLeadsCount: 2
    })

    render(<AppTabsLayout />)

    expect(screenCalls.map((screen) => screen.name)).toEqual([
      "home",
      "new-leads",
      "pipeline",
      "appointments",
      "settings"
    ])

    expect(screenCalls.find((screen) => screen.name === "settings")?.options).toMatchObject({
      href: null
    })
    expect(screenCalls.find((screen) => screen.name === "new-leads")?.options).toMatchObject({
      tabBarBadge: " "
    })
  })

  it("uses the refreshed purple token for the active tab state", () => {
    useSession.mockReturnValue({
      session: { user: { id: "agent-1" } },
      isBootstrapping: false,
      passwordRecoveryPending: false,
      unreadNewLeadsCount: 0
    })

    render(<AppTabsLayout />)

    expect(tabsCalls[0]?.screenOptions).toMatchObject({
      tabBarActiveTintColor: "#6f3ff5"
    })
  })
})
