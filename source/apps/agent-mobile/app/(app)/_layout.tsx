import { Redirect, Tabs } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { mobileTheme } from "@showready/design-system"
import { useSession } from "@/providers/session-provider"

export default function AppTabsLayout() {
  const { session, isBootstrapping, unreadNewLeadsCount, passwordRecoveryPending } = useSession()

  if (!isBootstrapping && !session) {
    return <Redirect href={"/(auth)/sign-in" as never} />
  }

  if (!isBootstrapping && passwordRecoveryPending) {
    return <Redirect href={"/reset-password" as never} />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: mobileTheme.colors.background
        },
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 96,
          paddingTop: 14,
          paddingBottom: 18,
          backgroundColor: mobileTheme.colors.surface,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: mobileTheme.colors.border,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          ...mobileTheme.elevation.floating
        },
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: 16,
          fontWeight: "800"
        },
        tabBarItemStyle: {
          borderRadius: 22
        },
        tabBarActiveTintColor: mobileTheme.colors.brand,
        tabBarInactiveTintColor: mobileTheme.colors.mutedInk
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="new-leads"
        options={{
          title: "New Leads",
          tabBarIcon: ({ color, size }) => <Feather name="inbox" color={color} size={size} />,
          tabBarBadge: unreadNewLeadsCount > 0 ? " " : undefined,
          tabBarBadgeStyle:
            unreadNewLeadsCount > 0
              ? {
                  minWidth: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: mobileTheme.colors.accent,
                  top: 8
                }
              : undefined
        }}
      />
      <Tabs.Screen
        name="pipeline"
        options={{
          title: "Pipeline",
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Appointments",
          tabBarIcon: ({ color, size }) => <Feather name="calendar" color={color} size={size} />
        }}
      />
      <Tabs.Screen name="settings" options={{ title: "Settings", href: null }} />
    </Tabs>
  )
}
