import { render } from "@testing-library/react-native"
import { StyleSheet } from "react-native"
import { mobileTheme } from "@/lib/theme"
import { SegmentedControl } from "./segmented-control"

describe("SegmentedControl", () => {
  it("keeps every tabs label visible when only one option is selected", () => {
    const screen = render(
      <SegmentedControl
        value="scheduled"
        onChange={jest.fn()}
        variant="tabs"
        testIDPrefix="appointments-tab"
        options={[
          { label: "Upcoming", value: "scheduled" },
          { label: "Completed", value: "completed" },
          { label: "Cancelled", value: "cancelled" }
        ]}
      />
    )

    expect(screen.getByText("Upcoming")).toBeTruthy()
    expect(screen.getByText("Completed")).toBeTruthy()
    expect(screen.getByText("Cancelled")).toBeTruthy()
    expect(screen.getByTestId("appointments-tab-completed").props.accessibilityLabel).toBe(
      "Completed"
    )

    const completedStyle = StyleSheet.flatten(screen.getByText("Completed").props.style)
    const cancelledStyle = StyleSheet.flatten(screen.getByText("Cancelled").props.style)

    expect(completedStyle.color).toBe(mobileTheme.colors.ink)
    expect(cancelledStyle.color).toBe(mobileTheme.colors.ink)
    expect(completedStyle.zIndex).toBeGreaterThan(0)
    expect(cancelledStyle.zIndex).toBeGreaterThan(0)
  })
})
