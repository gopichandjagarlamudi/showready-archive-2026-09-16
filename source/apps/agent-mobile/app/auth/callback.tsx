import { useEffect, useMemo, useState } from "react"
import { Redirect, useLocalSearchParams } from "expo-router"
import { LoadingScreen } from "../../components/loading-screen"
import { useSession } from "../../providers/session-provider"

const AUTH_CALLBACK_BASE_URL = "showready://auth/callback"

type SearchParams = Record<string, string | string[] | undefined>

export function buildAuthCallbackUrlFromParams(params: SearchParams) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item)
      }
      continue
    }

    if (typeof value === "string") {
      searchParams.set(key, value)
    }
  }

  const queryString = searchParams.toString()

  return queryString ? `${AUTH_CALLBACK_BASE_URL}?${queryString}` : null
}

export default function AuthCallbackRoute() {
  const params = useLocalSearchParams() as SearchParams
  const { session, isBootstrapping, passwordRecoveryPending, restoreAuthCallbackUrl } = useSession()
  const callbackUrl = useMemo(() => buildAuthCallbackUrlFromParams(params), [params])
  const [isRestoringCallback, setIsRestoringCallback] = useState(Boolean(callbackUrl))

  useEffect(() => {
    if (!callbackUrl) {
      setIsRestoringCallback(false)
      return
    }

    let isMounted = true
    setIsRestoringCallback(true)

    restoreAuthCallbackUrl(callbackUrl).finally(() => {
      if (isMounted) {
        setIsRestoringCallback(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [callbackUrl, restoreAuthCallbackUrl])

  if (isBootstrapping || isRestoringCallback) {
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
