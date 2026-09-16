import { StyleSheet, Text, View } from "react-native"
import type { IntakeType } from "@showready/contracts"
import { mobileTheme } from "@/lib/theme"

export function LeadIntentChip({
  intakeType,
  testID
}: {
  intakeType: IntakeType
  testID?: string
}) {
  const isRental = intakeType === "rental"
  const label = isRental ? "Rent" : "Buy"

  return (
    <View
      style={[styles.chip, isRental ? styles.rentChip : styles.buyChip]}
      testID={testID}
    >
      <Text style={[styles.label, isRental ? styles.rentLabel : styles.buyLabel]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  buyChip: {
    backgroundColor: mobileTheme.colors.surfaceTint
  },
  rentChip: {
    backgroundColor: mobileTheme.colors.nurtureSoft
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0
  },
  buyLabel: {
    color: mobileTheme.colors.brandStrong
  },
  rentLabel: {
    color: mobileTheme.colors.accent
  }
})
