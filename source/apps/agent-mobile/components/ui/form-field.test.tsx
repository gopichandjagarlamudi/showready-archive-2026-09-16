import { fireEvent, render } from "@testing-library/react-native"
import { Keyboard, Platform, StyleSheet } from "react-native"
import { FormField } from "./form-field"

describe("FormField", () => {
  it("forwards testID to the text input", () => {
    const onChangeText = jest.fn()
    const screen = render(
      <FormField
        label="Brokerage"
        value=""
        onChangeText={onChangeText}
        testID="settings-brokerage-input"
      />
    )

    fireEvent.changeText(screen.getByTestId("settings-brokerage-input"), "Northline Realty")

    expect(onChangeText).toHaveBeenCalledWith("Northline Realty")
  })

  it("adds an iOS keyboard accessory so phone and number pads can be dismissed", () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(jest.fn())
    const screen = render(
      <FormField
        label="Phone"
        value=""
        onChangeText={jest.fn()}
        keyboardType="phone-pad"
        testID="lead-phone-input"
      />
    )

    const input = screen.getByTestId("lead-phone-input")

    if (Platform.OS === "ios") {
      expect(input.props.inputAccessoryViewID).toBe("lead-phone-input-keyboard-accessory")

      fireEvent.press(screen.getByTestId("lead-phone-input-keyboard-done"))

      expect(dismiss).toHaveBeenCalled()
    } else {
      expect(input.props.inputAccessoryViewID).toBeUndefined()
    }

    dismiss.mockRestore()
  })

  it("uses compact input spacing for email fields so addresses fit on narrow screens", () => {
    const screen = render(
      <FormField
        label="Email"
        value="carry-forward@example.com"
        onChangeText={jest.fn()}
        keyboardType="email-address"
        testID="email-input"
      />
    )

    expect(StyleSheet.flatten(screen.getByTestId("email-input").props.style)).toEqual(
      expect.objectContaining({
        fontSize: 14,
        paddingHorizontal: 12
      })
    )
  })

  it("allows compact multiline fields in constrained sheets", () => {
    const screen = render(
      <FormField
        label="Note"
        value=""
        onChangeText={jest.fn()}
        multiline
        multilineMinHeight={72}
        testID="lead-override-note-input"
      />
    )

    expect(StyleSheet.flatten(screen.getByTestId("lead-override-note-input").props.style)).toEqual(
      expect.objectContaining({
        minHeight: 72,
        textAlignVertical: "top"
      })
    )
  })
})
