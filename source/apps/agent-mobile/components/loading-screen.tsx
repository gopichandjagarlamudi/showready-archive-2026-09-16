import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { mobileTheme } from "@showready/design-system"

export function LoadingScreen() {
  return (
    <View style={styles.container} testID="loading-screen">
      <ActivityIndicator size="large" color={mobileTheme.colors.brand} />
      <Text style={styles.label}>Preparing your command center…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: mobileTheme.colors.background
  },
  label: {
    color: mobileTheme.colors.mutedInk,
    fontSize: 15
  }
})
