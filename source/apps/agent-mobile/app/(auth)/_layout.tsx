import { Redirect, Stack } from "expo-router"
import { useSession } from "../../providers/session-provider"

export default function AuthLayout() {
  const { session, isBootstrapping, passwordRecoveryPending } = useSession()

  if (!isBootstrapping && session && !passwordRecoveryPending) {
    return <Redirect href="/(app)/home" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
