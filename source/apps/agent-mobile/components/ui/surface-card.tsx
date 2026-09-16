import type { PropsWithChildren } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { StyleSheet, View } from "react-native"
import { mobileTheme } from "@/lib/theme"

export function SurfaceCard({
  children,
  style,
  testID
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>
  testID?: string
}>) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    padding: 24,
    gap: 14,
    ...mobileTheme.elevation.card
  }
})
