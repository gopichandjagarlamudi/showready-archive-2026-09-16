import { StyleSheet, Text, View } from "react-native"
import type { LeadStage, Recommendation } from "@showready/contracts"
import { getStagePresentation } from "@/lib/stage-presentation"
import { mobileTheme } from "@/lib/theme"

export function StageChip({
  stage,
  recommendation
}: {
  stage?: LeadStage
  recommendation?: Recommendation
}) {
  const presentation = getStagePresentation(stage, recommendation)

  return (
    <View style={[styles.chip, { backgroundColor: presentation.backgroundColor }]}>
      <Text style={[styles.label, { color: presentation.color }]}>{presentation.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
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
    fontWeight: "800"
  }
})
