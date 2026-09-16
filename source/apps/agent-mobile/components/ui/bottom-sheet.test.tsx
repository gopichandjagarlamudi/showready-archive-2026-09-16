import { render } from "@testing-library/react-native"
import { ScrollView, StyleSheet, Text } from "react-native"
import { BottomSheet } from "./bottom-sheet"

describe("BottomSheet", () => {
  it("dismisses when the sheet is swiped down", () => {
    const onClose = jest.fn()
    const screen = render(
      <BottomSheet visible title="Actions" onClose={onClose} testID="demo-sheet">
        <Text>Sheet content</Text>
      </BottomSheet>
    )

    const sheet = screen.getByTestId("demo-sheet")

    sheet.props.onTouchStart({ nativeEvent: { locationY: 40, pageY: 100 } })
    expect(sheet.props.onMoveShouldSetResponder({ nativeEvent: { locationY: 60, pageY: 120 } })).toBe(true)
    sheet.props.onResponderMove({ nativeEvent: { locationY: 132, pageY: 192 } })
    sheet.props.onResponderRelease({ nativeEvent: { locationY: 132, pageY: 192 } })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not dismiss when scrollable content is swiped", () => {
    const onClose = jest.fn()
    const screen = render(
      <BottomSheet visible title="Actions" onClose={onClose} testID="demo-sheet">
        <Text>Sheet content</Text>
      </BottomSheet>
    )

    const sheet = screen.getByTestId("demo-sheet")

    sheet.props.onTouchStart({ nativeEvent: { locationY: 180, pageY: 300 } })
    expect(sheet.props.onMoveShouldSetResponder({ nativeEvent: { locationY: 230, pageY: 350 } })).toBe(false)
    sheet.props.onResponderMove({ nativeEvent: { locationY: 260, pageY: 380 } })
    sheet.props.onResponderRelease({ nativeEvent: { locationY: 260, pageY: 380 } })

    expect(onClose).not.toHaveBeenCalled()
  })

  it("keeps compact sheet actions clear of the bottom edge", () => {
    const screen = render(
      <BottomSheet visible title="Actions" onClose={jest.fn()} testID="demo-sheet">
        <Text>Sheet content</Text>
      </BottomSheet>
    )

    const sheetStyle = StyleSheet.flatten(screen.getByTestId("demo-sheet").props.style)
    const contentStyle = StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle)

    expect(sheetStyle.minHeight).toBeGreaterThanOrEqual(280)
    expect(sheetStyle.paddingBottom).toBeGreaterThanOrEqual(28)
    expect(contentStyle.paddingBottom).toBeGreaterThanOrEqual(96)
  })

  it("lets iOS scroll sheet content above the keyboard while preserving button taps", () => {
    const screen = render(
      <BottomSheet visible title="Actions" onClose={jest.fn()} testID="demo-sheet">
        <Text>Sheet content</Text>
      </BottomSheet>
    )

    const scrollView = screen.UNSAFE_getByType(ScrollView)

    expect(scrollView.props.automaticallyAdjustKeyboardInsets).toBe(true)
    expect(scrollView.props.keyboardDismissMode).toBe("interactive")
    expect(scrollView.props.keyboardShouldPersistTaps).toBe("always")
  })
})
