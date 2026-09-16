import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native"
import { mobileTheme } from "@/lib/theme"

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  multiline = false,
  multilineMinHeight,
  autoCapitalize = "sentences",
  autoCorrect = true,
  keyboardType,
  secureTextEntry = false,
  textContentType,
  autoComplete,
  testID
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  error?: string
  helperText?: string
  multiline?: boolean
  multilineMinHeight?: number
  autoCapitalize?: "none" | "sentences" | "words" | "characters"
  autoCorrect?: boolean
  keyboardType?: "default" | "email-address" | "numeric" | "number-pad" | "decimal-pad" | "phone-pad"
  secureTextEntry?: boolean
  textContentType?:
    | "none"
    | "name"
    | "emailAddress"
    | "telephoneNumber"
    | "password"
    | "newPassword"
    | "organizationName"
    | "username"
  autoComplete?:
    | "off"
    | "name"
    | "email"
    | "tel"
    | "street-address"
    | "username"
    | "password"
    | "new-password"
  testID?: string
}) {
  const accessoryID = Platform.OS === "ios" && testID ? `${testID}-keyboard-accessory` : undefined

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mobileTheme.colors.mutedInk}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        autoComplete={autoComplete}
        inputAccessoryViewID={accessoryID}
        style={[
          styles.input,
          keyboardType === "email-address" ? styles.emailInput : null,
          multiline ? styles.multiline : null,
          multiline && multilineMinHeight !== undefined ? { minHeight: multilineMinHeight } : null,
          error ? styles.inputError : null
        ]}
      />
      {accessoryID ? (
        <InputAccessoryView nativeID={accessoryID}>
          <View style={styles.accessory}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done editing"
              onPress={Keyboard.dismiss}
              style={({ pressed }) => [
                styles.accessoryButton,
                pressed ? styles.accessoryButtonPressed : null
              ]}
              testID={`${testID}-keyboard-done`}
            >
              <Text style={styles.accessoryButtonText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
      {helperText && !error ? <Text style={styles.helper}>{helperText}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    gap: 8
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
    color: mobileTheme.colors.brandStrong
  },
  input: {
    minHeight: 52,
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: mobileTheme.colors.ink,
    fontSize: mobileTheme.typography.body
  },
  emailInput: {
    paddingHorizontal: 12,
    fontSize: 14
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: "top"
  },
  helper: {
    color: mobileTheme.colors.subtleInk,
    fontSize: mobileTheme.typography.bodySmall,
    lineHeight: 21
  },
  inputError: {
    borderColor: mobileTheme.colors.lost
  },
  error: {
    color: mobileTheme.colors.lost,
    fontSize: mobileTheme.typography.bodySmall,
    lineHeight: 21
  },
  accessory: {
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  accessoryButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: mobileTheme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileTheme.colors.surfaceMuted
  },
  accessoryButtonPressed: {
    opacity: 0.86
  },
  accessoryButtonText: {
    color: mobileTheme.colors.brandStrong,
    fontSize: mobileTheme.typography.bodySmall,
    fontWeight: "800"
  }
})
