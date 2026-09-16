import { Pressable, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { mobileTheme } from "@/lib/theme"

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  testIDPrefix,
  variant = "pill"
}: {
  value: T
  options: Array<{ label: string; value: T }>
  onChange: (value: T) => void
  testIDPrefix?: string
  variant?: "pill" | "tabs"
}) {
  return (
    <View style={[styles.container, variant === "tabs" ? styles.tabsContainer : null]}>
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(option.value)}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
            style={({ pressed }) => [
              styles.option,
              variant === "tabs" ? styles.tabOption : null,
              isSelected && variant === "pill" ? styles.optionSelected : null,
              isSelected && variant === "tabs" ? styles.tabOptionSelected : null,
              pressed ? styles.optionPressed : null
            ]}
          >
            {isSelected && variant === "pill" ? (
              <LinearGradient
                colors={[...mobileTheme.gradients.tab]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[
                styles.label,
                variant === "tabs" ? styles.tabLabel : null,
                isSelected && variant === "pill" ? styles.labelSelected : null,
                isSelected && variant === "tabs" ? styles.tabLabelSelected : null
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 0,
    padding: 6,
    borderRadius: mobileTheme.radii.pill,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface
  },
  tabsContainer: {
    padding: 6,
    borderRadius: mobileTheme.radii.card,
    backgroundColor: mobileTheme.colors.surface,
    gap: 4
  },
  option: {
    flex: 1,
    minHeight: 54,
    borderRadius: mobileTheme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: "hidden"
  },
  optionSelected: {
    backgroundColor: "transparent"
  },
  tabOption: {
    borderRadius: mobileTheme.radii.control
  },
  tabOptionSelected: {
    backgroundColor: mobileTheme.colors.surfaceTint,
    borderBottomWidth: 3,
    borderBottomColor: mobileTheme.colors.brand
  },
  optionPressed: {
    opacity: 0.88
  },
  label: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: mobileTheme.colors.mutedInk,
    textAlign: "center",
    zIndex: 1,
    elevation: 1,
    includeFontPadding: false
  },
  labelSelected: {
    color: mobileTheme.colors.inverse
  },
  tabLabel: {
    color: mobileTheme.colors.ink
  },
  tabLabelSelected: {
    color: mobileTheme.colors.brandStrong
  }
})
