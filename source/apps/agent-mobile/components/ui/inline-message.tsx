import { StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { mobileTheme } from "@/lib/theme"

export function InlineMessage({
  title,
  message,
  tone = "warning"
}: {
  title: string
  message: string
  tone?: "success" | "warning" | "error"
}) {
  const palette =
    tone === "success"
      ? {
          backgroundColor: mobileTheme.colors.wonSoft,
          color: mobileTheme.colors.won
        }
      : tone === "error"
        ? {
            backgroundColor: mobileTheme.colors.lostSoft,
            color: mobileTheme.colors.lost
          }
        : {
            backgroundColor: mobileTheme.colors.nurtureSoft,
            color: mobileTheme.colors.nurture
          }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.backgroundColor, borderColor: palette.color }
      ]}
    >
      <Text style={[styles.title, { color: palette.color }]}>{title}</Text>
      <View style={styles.bodyRow}>
        <Feather
          name={tone === "success" ? "check-circle" : tone === "error" ? "alert-circle" : "info"}
          size={16}
          color={palette.color}
        />
        <Text style={[styles.body, { color: palette.color }]}>{message}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    padding: 14,
    gap: 6
  },
  title: {
    fontSize: 13,
    fontWeight: "800"
  },
  bodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  body: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  }
})
