import { render } from "@testing-library/react-native"
import RootLayout from "../app/_layout"

const stackCalls: Array<{ screenOptions?: Record<string, unknown> }> = []
const screenCalls: Array<{ name: string; options?: Record<string, unknown> }> = []

jest.mock("expo-router", () => {
  const React = require("react")
  const { View } = require("react-native")

  function Stack(props: { children?: React.ReactNode; screenOptions?: Record<string, unknown> }) {
    stackCalls.push(props)
    return <View>{props.children}</View>
  }

  Stack.Screen = (props: { name: string; options?: Record<string, unknown> }) => {
    screenCalls.push(props)
    return null
  }

  return {
    Stack,
    usePathname: jest.fn(() => "/(app)/home")
  }
})

jest.mock("../lib/diagnostics/error-boundary", () => ({
  DiagnosticsErrorBoundary: ({ children }: { children: React.ReactNode }) => {
    const React = require("react")
    const { View } = require("react-native")

    return React.createElement(View, null, children)
  }
}))

jest.mock("../lib/diagnostics/service", () => ({
  flushDiagnostics: jest.fn(async () => {}),
  initializeDiagnostics: jest.fn(async () => {}),
  markDiagnosticsScreen: jest.fn(async () => {}),
  pauseDiagnosticsSession: jest.fn(async () => {}),
  resumeDiagnosticsSession: jest.fn(async () => {})
}))

jest.mock("../providers/session-provider", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => {
    const React = require("react")
    const { View } = require("react-native")

    return React.createElement(View, null, children)
  }
}))

describe("RootLayout", () => {
  beforeEach(() => {
    stackCalls.length = 0
    screenCalls.length = 0
  })

  it("keeps hidden headers while enabling native swipe gestures for lead detail", () => {
    render(<RootLayout />)

    expect(stackCalls[0]?.screenOptions).toMatchObject({
      headerShown: false,
      gestureEnabled: true
    })
    expect(screenCalls.find((screen) => screen.name === "lead/[id]")?.options).toMatchObject({
      gestureEnabled: true
    })
  })
})
