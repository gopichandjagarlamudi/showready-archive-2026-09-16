import { Redirect } from "expo-router"
import { LoadingScreen } from "../components/loading-screen"
import { useSession } from "../providers/session-provider"

export default function IndexRoute() {
  const { session, isBootstrapping, passwordRecoveryPending } = useSession()

  if (isBootstrapping) {
    return <LoadingScreen />
  }

  if (passwordRecoveryPending) {
    return <Redirect href={"/reset-password" as never} />
  }

  if (session) {
    return <Redirect href="/(app)/home" />
  }

  return <Redirect href={"/(auth)/sign-in" as never} />
}
