import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { PropsWithChildren } from "react"
import * as Crypto from "expo-crypto"
import * as Notifications from "expo-notifications"
import { AppState, Linking, Platform } from "react-native"
import type { AppStateStatus } from "react-native"
import type { Session } from "@supabase/supabase-js"
import { router } from "expo-router"
import { createMobileApiClient } from "@showready/infrastructure"
import { isAuthCallbackUrl, restoreSessionFromUrl } from "../lib/auth-oauth"
import type { RestoredAuthLinkResult } from "../lib/auth-oauth"
import {
  clearStoredPasswordRecoveryPending,
  getStoredPasswordRecoveryPending,
  setStoredPasswordRecoveryPending
} from "../lib/auth-password"
import {
  captureDiagnosticsError,
  flushDiagnostics,
  reportApiRequestError,
  setDiagnosticsApiClient
} from "../lib/diagnostics/service"
import { getApiBaseUrl } from "../lib/env"
import { supabase } from "../lib/supabase"

type SessionContextValue = {
  session: Session | null
  isBootstrapping: boolean
  workspaceVersion: number
  unreadNewLeadsCount: number
  passwordRecoveryPending: boolean
  clearPasswordRecovery: () => void
  refreshWorkspace: () => void
  restoreAuthCallbackUrl: (url: string) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)
const MobileApiContext = createContext<ReturnType<typeof createMobileApiClient> | null>(null)

function createClientEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return Crypto.randomUUID()
}

function getMobilePlatform() {
  return Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown"
}

function reportAuthDiagnosticsError(error: unknown, context: Record<string, string>) {
  void captureDiagnosticsError(error, {
    eventType: "auth.event",
    category: "auth",
    severity: "warning",
    context
  }).catch(() => {})
}

async function clearStaleStoredSession(error: unknown) {
  reportAuthDiagnosticsError(error, {
    source: "session-bootstrap",
    reason: "stored-session-refresh-failed"
  })

  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" })

    if (signOutError) {
      reportAuthDiagnosticsError(signOutError, {
        action: "clear-stale-local-session"
      })
    }
  } catch (signOutError) {
    reportAuthDiagnosticsError(signOutError, {
      action: "clear-stale-local-session"
    })
  } finally {
    await supabase.auth.stopAutoRefresh()
  }
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const handledAuthCallbackUrlsRef = useRef<Set<string>>(new Set())
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false)
  const [workspaceVersion, setWorkspaceVersion] = useState(0)
  const [unreadNewLeadsCount, setUnreadNewLeadsCount] = useState(0)
  const api = useMemo(
    () => {
      const apiBaseUrl = getApiBaseUrl()

      return createMobileApiClient({
        supabase,
        apiBaseUrl,
        getAccessToken: async () => {
          if (sessionRef.current?.access_token) {
            return sessionRef.current.access_token
          }

          const { data } = await supabase.auth.getSession()
          return data.session?.access_token ?? null
        },
        onRequestError: (input) => {
          void reportApiRequestError(input)
        }
      })
    },
    []
  )

  function refreshWorkspace() {
    api.clearCache()
    setWorkspaceVersion((current) => current + 1)
  }

  function clearPasswordRecovery() {
    setPasswordRecoveryPending(false)
    void clearStoredPasswordRecoveryPending()
  }

  const activatePasswordRecovery = useCallback(async () => {
    await setStoredPasswordRecoveryPending()
    setPasswordRecoveryPending(true)
    router.replace("/reset-password" as never)
  }, [])

  const showInvalidPasswordRecoveryLink = useCallback(async () => {
    await clearStoredPasswordRecoveryPending()
    setPasswordRecoveryPending(false)
    router.replace({
      pathname: "/(auth)/sign-in",
      params: {
        reset: "invalid"
      }
    } as never)
  }, [])

  const applyRestoredAuthLink = useCallback(async (result: RestoredAuthLinkResult) => {
    if (!result.restored) {
      if ("reason" in result && result.reason === "password-recovery-invalid") {
        await showInvalidPasswordRecoveryLink()
      }

      return
    }

    if (result.kind === "password-recovery") {
      await activatePasswordRecovery()
    }
  }, [activatePasswordRecovery, showInvalidPasswordRecoveryLink])

  const syncCurrentAuthSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    sessionRef.current = data.session
    setSession(data.session)
  }, [])

  const restoreAuthCallbackUrl = useCallback(async (url: string) => {
    if (!isAuthCallbackUrl(url) || handledAuthCallbackUrlsRef.current.has(url)) {
      return
    }

    handledAuthCallbackUrlsRef.current.add(url)

    try {
      const result = await restoreSessionFromUrl(url)
      await applyRestoredAuthLink(result)

      if (result.restored && result.kind === "sign-in") {
        await syncCurrentAuthSession()
      }
    } catch (error) {
      void captureDiagnosticsError(error, {
        eventType: "auth.event",
        category: "auth",
        severity: "warning",
        context: {
          phase: "auth-callback-route"
        }
      })
    }
  }, [applyRestoredAuthLink, syncCurrentAuthSession])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    setDiagnosticsApiClient(api)
    void flushDiagnostics()

    return () => {
      setDiagnosticsApiClient(null)
    }
  }, [api])

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const route = notification.request.content.data?.route

      if (route === "/(app)/new-leads") {
        refreshWorkspace()
      }
    })

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route

      if (route === "/(app)/new-leads") {
        refreshWorkspace()
        router.push("/new-leads")
      }
    })

    return () => {
      receivedSubscription.remove()
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function bootstrapSession() {
      try {
        const storedPasswordRecoveryPending = await getStoredPasswordRecoveryPending()

        const { data, error } = await supabase.auth.getSession()

        if (error) {
          await clearStaleStoredSession(error)

          if (isMounted) {
            sessionRef.current = null
            setSession(null)
          }

          return
        }

        if (!isMounted) {
          return
        }

        if (storedPasswordRecoveryPending && data.session) {
          setPasswordRecoveryPending(true)
          router.replace("/reset-password" as never)
        }

        if (storedPasswordRecoveryPending && !data.session) {
          await showInvalidPasswordRecoveryLink()
        }

        sessionRef.current = data.session
        setSession(data.session)
      } catch (error) {
        if (isMounted) {
          sessionRef.current = null
          setSession(null)
        }

        void captureDiagnosticsError(error, {
          eventType: "error.handled",
          category: "error",
          severity: "error",
          context: {
            source: "session-bootstrap"
          }
        })
      } finally {
        if (isMounted) {
          setIsBootstrapping(false)
        }
      }
    }

    bootstrapSession()

    const subscription = supabase.auth.onAuthStateChange((event, nextSession) => {
      sessionRef.current = nextSession
      setSession(nextSession)
      setIsBootstrapping(false)

      if (event === "PASSWORD_RECOVERY") {
        void activatePasswordRecovery()
      }

      if (event === "SIGNED_OUT") {
        setPasswordRecoveryPending(false)
      }
    })

    return () => {
      isMounted = false
      subscription.data.subscription.unsubscribe()
    }
  }, [activatePasswordRecovery, showInvalidPasswordRecoveryLink])

  useEffect(() => {
    let isMounted = true

    Linking.getInitialURL()
      .then((url) => {
        if (isMounted && url) {
          void restoreAuthCallbackUrl(url)
        }
      })
      .catch((error) => {
        void captureDiagnosticsError(error, {
          eventType: "auth.event",
          category: "auth",
          severity: "warning",
          context: {
            phase: "auth-callback-initial-url"
          }
        })
      })

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void restoreAuthCallbackUrl(url)
    })

    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [restoreAuthCallbackUrl])

  useEffect(() => {
    if (!session) {
      void supabase.auth.stopAutoRefresh()
      return
    }

    function syncAutoRefresh(appState: AppStateStatus) {
      if (appState === "active") {
        void supabase.auth.startAutoRefresh()
        return
      }

      void supabase.auth.stopAutoRefresh()
    }

    syncAutoRefresh(AppState.currentState)

    const subscription = AppState.addEventListener("change", syncAutoRefresh)

    return () => {
      subscription.remove()
      void supabase.auth.stopAutoRefresh()
    }
  }, [session])

  useEffect(() => {
    const agentId = passwordRecoveryPending ? null : session?.user.id

    if (!agentId) {
      setWorkspaceVersion(0)
      setUnreadNewLeadsCount(0)
      return
    }

    setWorkspaceVersion(0)

    const channel = supabase
      .channel(`mobile-workspace-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `agent_id=eq.${agentId}`
        },
        () => {
          setWorkspaceVersion((current) => current + 1)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `agent_id=eq.${agentId}`
        },
        () => {
          setWorkspaceVersion((current) => current + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [passwordRecoveryPending, session?.user.id])

  useEffect(() => {
    const agentId = passwordRecoveryPending ? null : session?.user.id

    if (!agentId) {
      setUnreadNewLeadsCount(0)
      return
    }

    let isMounted = true

    api
      .getDashboardSummary()
      .then((summary) => {
        if (isMounted) {
          setUnreadNewLeadsCount(summary.newLeads)
        }
      })
      .catch(() => {
        if (isMounted) {
          setUnreadNewLeadsCount(0)
        }
      })

    return () => {
      isMounted = false
    }
  }, [api, passwordRecoveryPending, session?.user.id, workspaceVersion])

  useEffect(() => {
    const agentId = passwordRecoveryPending ? null : session?.user.id

    if (!agentId) {
      return
    }

    let isMounted = true

    async function registerPushToken() {
      try {
        const permissions = await Notifications.getPermissionsAsync()
        const granted =
          permissions.status === "granted"
            ? permissions
            : await Notifications.requestPermissionsAsync()

        if (granted.status !== "granted") {
          return
        }

        const token = await Notifications.getExpoPushTokenAsync()

        if (!isMounted || !token.data) {
          return
        }

        await api.registerPushToken({
          expoPushToken: token.data,
          platform: getMobilePlatform()
        })

        const occurredAt = new Date().toISOString()

        await api.submitConsentRecords({
          records: [
            {
              id: createClientEventId(),
              subjectType: "agent",
              consentType: "push_notifications",
              status: "granted",
              source: "mobile-session-provider",
              occurredAt,
              metadata: {
                permissionStatus: granted.status
              }
            }
          ]
        })

        await api.submitProductEvents({
          events: [
            {
              id: createClientEventId(),
              occurredAt,
              eventName: "notification.token_registered",
              resourceType: "notification",
              platform: getMobilePlatform(),
              properties: {
                permissionStatus: granted.status
              }
            }
          ]
        })
      } catch (error) {
        void captureDiagnosticsError(error, {
          eventType: "notification.event",
          category: "notification",
          severity: "warning",
          context: {
            source: "register-push-token"
          }
        })
      }
    }

    void registerPushToken()

    return () => {
      isMounted = false
    }
  }, [api, passwordRecoveryPending, session?.user.id])

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      void captureDiagnosticsError(error, {
        eventType: "auth.event",
        category: "auth",
        severity: "error",
        context: {
          action: "sign-out"
        }
      })
      throw error
    }

    sessionRef.current = null
    setSession(null)
    setPasswordRecoveryPending(false)
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        isBootstrapping,
        workspaceVersion,
        unreadNewLeadsCount,
        passwordRecoveryPending,
        clearPasswordRecovery,
        refreshWorkspace,
        restoreAuthCallbackUrl,
        signOut
      }}
    >
      <MobileApiContext.Provider value={api}>{children}</MobileApiContext.Provider>
    </SessionContext.Provider>
  )
}

export function useSession() {
  const value = useContext(SessionContext)

  if (!value) {
    throw new Error("useSession must be used inside SessionProvider.")
  }

  return value
}

export function useMobileApi() {
  const value = useContext(MobileApiContext)

  if (!value) {
    throw new Error("useMobileApi must be used inside SessionProvider.")
  }

  return value
}
