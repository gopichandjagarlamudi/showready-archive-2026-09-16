import { Pressable, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { mobileTheme } from "@/lib/theme"

export function ActionButton({
  label,
  onPress,
  disabled = false,
  tone = "primary",
  testID,
  icon
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  tone?: "primary" | "secondary" | "danger"
  testID?: string
  icon?: keyof typeof Feather.glyphMap
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        tone === "primary"
          ? styles.primary
          : tone === "danger"
            ? styles.danger
            : styles.secondary,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null
      ]}
    >
      {tone === "primary" ? (
        <LinearGradient
          testID={testID ? `${testID}-gradient` : undefined}
          colors={[...mobileTheme.gradients.primary]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.content}>
        {icon ? (
          <Feather
            name={icon}
            size={18}
            color={
              tone === "primary"
                ? mobileTheme.colors.inverse
                : tone === "danger"
                  ? mobileTheme.colors.lost
                  : mobileTheme.colors.brand
            }
          />
        ) : null}
        <Text
          style={[
            styles.label,
            tone === "primary"
              ? styles.primaryLabel
              : tone === "danger"
                ? styles.dangerLabel
                : styles.secondaryLabel
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: mobileTheme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 15,
    overflow: "hidden"
  },
  primary: {
    ...mobileTheme.elevation.card
  },
  secondary: {
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.focus
  },
  danger: {
    backgroundColor: mobileTheme.colors.lostSoft,
    borderWidth: 1,
    borderColor: mobileTheme.colors.lostSoft
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800"
  },
  primaryLabel: {
    color: mobileTheme.colors.inverse
  },
  secondaryLabel: {
    color: mobileTheme.colors.brand
  },
  dangerLabel: {
    color: mobileTheme.colors.lost
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }]
  },
  disabled: {
    opacity: 0.5
  }
})
