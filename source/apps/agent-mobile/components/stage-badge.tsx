import { StyleSheet, Text, View } from "react-native"
import { mobileTheme } from "@showready/design-system"
import type { LeadStage, Recommendation } from "@showready/contracts"

function colorsForStage(stage?: LeadStage, recommendation?: Recommendation) {
  if (recommendation === "show" || stage === "ready_to_show") {
    return { backgroundColor: mobileTheme.colors.readySoft, color: mobileTheme.colors.ready }
  }

  if (stage === "appointment_booked") {
    return { backgroundColor: mobileTheme.colors.appointmentSoft, color: mobileTheme.colors.appointment }
  }

  if (recommendation === "nurture" || stage === "nurture") {
    return { backgroundColor: mobileTheme.colors.nurtureSoft, color: mobileTheme.colors.nurture }
  }

  if (stage === "closed_won") {
    return { backgroundColor: mobileTheme.colors.wonSoft, color: mobileTheme.colors.won }
  }

  if (stage === "closed_lost") {
    return { backgroundColor: mobileTheme.colors.lostSoft, color: mobileTheme.colors.lost }
  }

  return { backgroundColor: mobileTheme.colors.holdSoft, color: mobileTheme.colors.hold }
}

export function StageBadge({
  label,
  stage,
  recommendation
}: {
  label: string
  stage?: LeadStage
  recommendation?: Recommendation
}) {
  const colors = colorsForStage(stage, recommendation)

  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundColor }]}>
      <Text style={[styles.label, { color: colors.color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "capitalize"
  }
})
