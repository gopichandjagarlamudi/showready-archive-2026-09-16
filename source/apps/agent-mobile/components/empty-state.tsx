import { StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { mobileTheme } from "@showready/design-system"
import { ActionButton } from "./ui/action-button"

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  actionTestID,
  actionTone,
  actionIcon,
  variant = "default",
  eyebrow,
  icon = "inbox"
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
  actionTestID?: string
  actionTone?: "primary" | "secondary"
  actionIcon?: keyof typeof Feather.glyphMap
  variant?: "default" | "guided"
  eyebrow?: string
  icon?: keyof typeof Feather.glyphMap
}) {
  return (
    <View style={[styles.container, variant === "guided" ? styles.guidedContainer : null]}>
      {variant === "guided" ? (
        <View style={styles.guidedBadge}>
          <Feather name={icon} size={48} color={mobileTheme.colors.brand} />
        </View>
      ) : null}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <ActionButton
          label={actionLabel}
          onPress={onAction}
          tone={actionTone ?? (variant === "guided" ? "primary" : "secondary")}
          icon={actionIcon}
          testID={actionTestID}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    borderRadius: mobileTheme.radii.card,
    padding: 22,
    backgroundColor: mobileTheme.colors.surface,
    gap: 8
  },
  guidedContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 360,
    paddingHorizontal: 28,
    paddingVertical: 42,
    borderColor: mobileTheme.colors.border,
    gap: 16,
    ...mobileTheme.elevation.card
  },
  guidedBadge: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileTheme.colors.surfaceTint
  },
  eyebrow: {
    color: mobileTheme.colors.brandStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0
  },
  title: {
    color: mobileTheme.colors.ink,
    fontSize: mobileTheme.typography.section,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center"
  },
  body: {
    color: mobileTheme.colors.mutedInk,
    fontSize: mobileTheme.typography.body,
    lineHeight: 26,
    textAlign: "center"
  }
})
