import type { PropsWithChildren } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { mobileTheme } from "@showready/design-system"

const showReadyMark = require("../assets/app-icon.png")

export type ScreenHeaderAction = {
  icon: keyof typeof Feather.glyphMap
  label: string
  onPress: () => void
  testID?: string
}

export function ScreenShell({
  title,
  subtitle,
  children,
  scrollable = true,
  contentStyle,
  testID,
  leadingAction,
  headerAction
}: PropsWithChildren<{
  title: string
  subtitle?: string
  scrollable?: boolean
  contentStyle?: StyleProp<ViewStyle>
  testID?: string
  eyebrow?: string
  leadingAction?: ScreenHeaderAction
  headerAction?: ScreenHeaderAction
}>) {
  const content = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.leadingCluster}>
            {leadingAction ? <HeaderIconButton action={leadingAction} /> : null}
            <View
              accessibilityRole="image"
              accessibilityLabel="ShowReady"
              style={styles.brandLockup}
            >
              <Image
                source={showReadyMark}
                resizeMode="cover"
                style={styles.brandMark}
                testID="showready-brand-mark"
              />
              <View style={styles.wordmark}>
                <Text style={styles.wordmarkShow}>Show</Text>
                <Text style={styles.wordmarkReady}>Ready</Text>
              </View>
            </View>
          </View>
          {headerAction ? <HeaderIconButton action={headerAction} /> : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.body, !scrollable ? styles.bodyStatic : null]}>{children}</View>
    </>
  )

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.screen} testID={testID}>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.content, contentStyle]}>{content}</View>
        )}
      </View>
    </SafeAreaView>
  )
}

function HeaderIconButton({ action }: { action: ScreenHeaderAction }) {
  return (
    <Pressable
      testID={action.testID}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.headerAction,
        pressed ? styles.headerActionPressed : null
      ]}
    >
      <Feather name={action.icon} size={20} color={mobileTheme.colors.ink} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: mobileTheme.colors.background
  },
  screen: {
    flex: 1,
    backgroundColor: mobileTheme.colors.background
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 132,
    gap: 18
  },
  hero: {
    gap: 10
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  leadingCluster: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: 8
  },
  brandLockup: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: 10
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9
  },
  wordmark: {
    flexDirection: "row",
    alignItems: "baseline"
  },
  wordmarkShow: {
    color: mobileTheme.colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800"
  },
  wordmarkReady: {
    color: mobileTheme.colors.brandAlt,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800"
  },
  headerAction: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: mobileTheme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileTheme.elevation.card
  },
  headerActionPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }]
  },
  title: {
    color: mobileTheme.colors.ink,
    fontSize: mobileTheme.typography.title,
    lineHeight: 40,
    fontWeight: "900"
  },
  subtitle: {
    color: mobileTheme.colors.mutedInk,
    fontSize: mobileTheme.typography.bodySmall,
    lineHeight: 22,
    maxWidth: 560
  },
  body: {
    gap: 16
  },
  bodyStatic: {
    flex: 1
  }
})
