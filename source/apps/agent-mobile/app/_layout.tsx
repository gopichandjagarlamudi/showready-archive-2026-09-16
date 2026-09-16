import { useEffect } from "react"
import { AppState, LogBox } from "react-native"
import { Stack, usePathname } from "expo-router"
import { DiagnosticsErrorBoundary } from "../lib/diagnostics/error-boundary"
import {
  flushDiagnostics,
  initializeDiagnostics,
  markDiagnosticsScreen,
  pauseDiagnosticsSession,
  resumeDiagnosticsSession
} from "../lib/diagnostics/service"
import { SessionProvider } from "../providers/session-provider"

if (__DEV__) {
  LogBox.ignoreLogs(["Looks like you have configured linking in multiple places."])
}

export default function RootLayout() {
  const pathname = usePathname()

  useEffect(() => {
    void initializeDiagnostics()

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void resumeDiagnosticsSession()
        return
      }

      if (nextState === "inactive" || nextState === "background") {
        void pauseDiagnosticsSession()
      }
    })

    const flushInterval = setInterval(() => {
      void flushDiagnostics()
    }, 30000)

    return () => {
      appStateSubscription.remove()
      clearInterval(flushInterval)
    }
  }, [])

  useEffect(() => {
    if (!pathname) {
      return
    }

    void markDiagnosticsScreen(pathname)
  }, [pathname])

  return (
    <DiagnosticsErrorBoundary>
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
          <Stack.Screen name="lead/[id]" options={{ gestureEnabled: true }} />
        </Stack>
      </SessionProvider>
    </DiagnosticsErrorBoundary>
  )
}
