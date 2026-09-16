import { fireEvent, render } from "@testing-library/react-native"
import { ScreenShell } from "./screen-shell"

describe("ScreenShell", () => {
  it("renders title and subtitle", () => {
    const screen = render(
      <ScreenShell title="Dashboard" subtitle="Overview">
        <></>
      </ScreenShell>
    )

    expect(screen.getByTestId("showready-brand-mark")).toBeTruthy()
    expect(screen.getByText("Show")).toBeTruthy()
    expect(screen.getByText("Ready")).toBeTruthy()
    expect(screen.getByText("Dashboard")).toBeTruthy()
    expect(screen.getByText("Overview")).toBeTruthy()
  })

  it("renders a contextual header action", () => {
    const onPress = jest.fn()
    const screen = render(
      <ScreenShell
        title="Dashboard"
        subtitle="Overview"
        headerAction={{
          icon: "settings",
          label: "Open settings",
          onPress,
          testID: "shell-header-action"
        }}
      >
        <></>
      </ScreenShell>
    )

    fireEvent.press(screen.getByTestId("shell-header-action"))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("renders testID on the screen wrapper view for accessible test selectors", () => {
    const screen = render(
      <ScreenShell title="Sign in" testID="sign-in-screen">
        <></>
      </ScreenShell>
    )

    expect(screen.getByTestId("sign-in-screen")).toBeTruthy()
  })

  it("renders a leading header action for detail navigation", () => {
    const onPress = jest.fn()
    const screen = render(
      <ScreenShell
        title="Lead detail"
        leadingAction={{
          icon: "chevron-left",
          label: "Back to leads",
          onPress,
          testID: "lead-back-chevron"
        }}
      >
        <></>
      </ScreenShell>
    )

    fireEvent.press(screen.getByTestId("lead-back-chevron"))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
