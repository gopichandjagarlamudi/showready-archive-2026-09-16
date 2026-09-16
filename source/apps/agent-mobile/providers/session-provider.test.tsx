import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { AppState, Linking, Pressable, Text } from "react-native"
import { SessionProvider, useSession } from "./session-provider"

const mockChannel = {
  on: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn()
}

const mockRemoveChannel = jest.fn()
const mockAuthUnsubscribe = jest.fn()
const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockSignOut = jest.fn()
const mockStartAutoRefresh = jest.fn()
const mockStopAutoRefresh = jest.fn()
const mockSupabaseChannel = jest.fn()
const mockRestoreSessionFromUrl = jest.fn()
const mockGetStoredPasswordRecoveryPending = jest.fn()
const mockSetStoredPasswordRecoveryPending = jest.fn()
const mockClearStoredPasswordRecoveryPending = jest.fn()
const mockCaptureDiagnosticsError = jest.fn()
const mockFlushDiagnostics = jest.fn()
const mockSetDiagnosticsApiClient = jest.fn()
const mockReportApiRequestError = jest.fn()
const mockClearCache = jest.fn()
const mockGetDashboardSummary = jest.fn()
const mockListNewLeads = jest.fn()
const mockRegisterPushToken = jest.fn()
const mockSubmitConsentRecords = jest.fn()
const mockSubmitProductEvents = jest.fn()
const mockRandomUUID = jest.fn()
const mockGetPermissionsAsync = jest.fn()
const mockRequestPermissionsAsync = jest.fn()
const mockGetExpoPushTokenAsync = jest.fn()
const mockAddNotificationReceivedListener = jest.fn()
const mockAddNotificationResponseReceivedListener = jest.fn()
const mockRouterPush = jest.fn()
const mockRouterReplace = jest.fn()
let notificationResponseListener: ((response: any) => void) | null = null
let notificationReceivedListener: ((response: any) => void) | null = null

jest.mock("@showready/infrastructure", () => ({
  createMobileApiClient: jest.fn(() => ({
    clearCache: (...args: unknown[]) => mockClearCache(...args),
    getDashboardSummary: (...args: unknown[]) => mockGetDashboardSummary(...args),
    listLeads: jest.fn(),
    listNewLeads: (...args: unknown[]) => mockListNewLeads(...args),
    registerPushToken: (...args: unknown[]) => mockRegisterPushToken(...args),
    submitConsentRecords: (...args: unknown[]) => mockSubmitConsentRecords(...args),
    submitProductEvents: (...args: unknown[]) => mockSubmitProductEvents(...args)
  }))
}))

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  addNotificationReceivedListener: (...args: unknown[]) =>
    mockAddNotificationReceivedListener(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args)
}))

jest.mock("expo-crypto", () => ({
  randomUUID: (...args: unknown[]) => mockRandomUUID(...args)
}))

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args)
  }
}))

jest.mock("../lib/auth-oauth", () => ({
  isAuthCallbackUrl: (url: string) => url.includes("auth/callback"),
  restoreSessionFromUrl: (...args: unknown[]) => mockRestoreSessionFromUrl(...args)
}))

jest.mock("../lib/auth-password", () => ({
  getStoredPasswordRecoveryPending: (...args: unknown[]) =>
    mockGetStoredPasswordRecoveryPending(...args),
  setStoredPasswordRecoveryPending: (...args: unknown[]) =>
    mockSetStoredPasswordRecoveryPending(...args),
  clearStoredPasswordRecoveryPending: (...args: unknown[]) =>
    mockClearStoredPasswordRecoveryPending(...args)
}))

jest.mock("../lib/diagnostics/service", () => ({
  captureDiagnosticsError: (...args: unknown[]) => mockCaptureDiagnosticsError(...args),
  flushDiagnostics: (...args: unknown[]) => mockFlushDiagnostics(...args),
  reportApiRequestError: (...args: unknown[]) => mockReportApiRequestError(...args),
  setDiagnosticsApiClient: (...args: unknown[]) => mockSetDiagnosticsApiClient(...args)
}))

jest.mock("../lib/env", () => ({
  getApiBaseUrl: jest.fn(() => "https://example.com")
}))

jest.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      startAutoRefresh: (...args: unknown[]) => mockStartAutoRefresh(...args),
      stopAutoRefresh: (...args: unknown[]) => mockStopAutoRefresh(...args)
    },
    channel: (...args: unknown[]) => mockSupabaseChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args)
  }
}))

function SessionValueProbe() {
  const { session, workspaceVersion, unreadNewLeadsCount, passwordRecoveryPending } = useSession()

  return (
    <>
      <Text testID="session-user">{session?.user.id ?? "none"}</Text>
      <Text testID="workspace-version">{workspaceVersion}</Text>
      <Text testID="unread-new-leads">{unreadNewLeadsCount}</Text>
      <Text testID="password-recovery-pending">
        {passwordRecoveryPending ? "yes" : "no"}
      </Text>
    </>
  )
}

function RestoreAuthLinkProbe({ url }: { url: string }) {
  const { passwordRecoveryPending, restoreAuthCallbackUrl } = useSession()

  return (
    <>
      <Text testID="password-recovery-pending">
        {passwordRecoveryPending ? "yes" : "no"}
      </Text>
      <Pressable
        testID="restore-auth-link"
        onPress={() => {
          void restoreAuthCallbackUrl(url)
        }}
      >
        <Text>Restore auth link</Text>
      </Pressable>
    </>
  )
}

describe("SessionProvider realtime refresh", () => {
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  let appStateChangeListener: ((state: string) => void) | null = null
  let appStateAddEventListenerSpy: jest.SpyInstance
  let linkingUrlListener: ((event: { url: string }) => void) | null = null
  let linkingAddEventListenerSpy: jest.SpyInstance
  let linkingGetInitialUrlSpy: jest.SpyInstance

  beforeEach(() => {
    appStateChangeListener = null
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      value: "active"
    })
    appStateAddEventListenerSpy = jest.spyOn(AppState, "addEventListener")
    appStateAddEventListenerSpy.mockImplementation((type, listener) => {
      if (type === "change") {
        appStateChangeListener = listener as (state: string) => void
      }

      return {
        remove: jest.fn()
      } as never
    })
    linkingUrlListener = null
    linkingAddEventListenerSpy = jest.spyOn(Linking, "addEventListener")
    linkingAddEventListenerSpy.mockImplementation((type, listener) => {
      if (type === "url") {
        linkingUrlListener = listener as (event: { url: string }) => void
      }

      return {
        remove: jest.fn()
      } as never
    })
    linkingGetInitialUrlSpy = jest.spyOn(Linking, "getInitialURL")
    linkingGetInitialUrlSpy.mockResolvedValue(null)

    mockChannel.on.mockReset()
    mockChannel.on.mockImplementation(() => mockChannel)
    mockChannel.subscribe.mockReset()
    mockChannel.subscribe.mockImplementation(() => mockChannel)
    mockChannel.unsubscribe.mockReset()

    mockRemoveChannel.mockReset()
    mockAuthUnsubscribe.mockReset()
    mockGetSession.mockReset()
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "agent-1"
          }
        }
      }
    })

    mockOnAuthStateChange.mockReset()
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: mockAuthUnsubscribe
        }
      }
    })

    mockSignOut.mockReset()
    mockSignOut.mockResolvedValue({ error: null })
    mockStartAutoRefresh.mockReset()
    mockStartAutoRefresh.mockResolvedValue(undefined)
    mockStopAutoRefresh.mockReset()
    mockStopAutoRefresh.mockResolvedValue(undefined)
    mockSupabaseChannel.mockReset()
    mockSupabaseChannel.mockReturnValue(mockChannel)
    mockRestoreSessionFromUrl.mockReset()
    mockGetStoredPasswordRecoveryPending.mockReset()
    mockGetStoredPasswordRecoveryPending.mockResolvedValue(false)
    mockSetStoredPasswordRecoveryPending.mockReset()
    mockSetStoredPasswordRecoveryPending.mockResolvedValue(undefined)
    mockClearStoredPasswordRecoveryPending.mockReset()
    mockClearStoredPasswordRecoveryPending.mockResolvedValue(undefined)
    mockCaptureDiagnosticsError.mockReset()
    mockCaptureDiagnosticsError.mockResolvedValue(undefined)
    mockFlushDiagnostics.mockReset()
    mockFlushDiagnostics.mockResolvedValue(undefined)
    mockSetDiagnosticsApiClient.mockReset()
    mockReportApiRequestError.mockReset()
    mockClearCache.mockReset()
    mockReportApiRequestError.mockResolvedValue(undefined)
    mockGetDashboardSummary.mockReset()
    mockGetDashboardSummary.mockResolvedValue({
      totalLeads: 1,
      newLeads: 1,
      readyToShow: 0,
      appointmentBooked: 0,
      nurture: 0,
      hold: 0,
      averageScore: 0
    })
    mockListNewLeads.mockReset()
    mockListNewLeads.mockResolvedValue([{ id: "lead-new" }])
    mockRegisterPushToken.mockReset()
    mockRegisterPushToken.mockResolvedValue({ ok: true })
    mockSubmitConsentRecords.mockReset()
    mockSubmitConsentRecords.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    mockSubmitProductEvents.mockReset()
    mockSubmitProductEvents.mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejectedEventIds: []
    })
    mockRandomUUID.mockReset()
    mockRandomUUID
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222")
    mockGetPermissionsAsync.mockReset()
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" })
    mockRequestPermissionsAsync.mockReset()
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" })
    mockGetExpoPushTokenAsync.mockReset()
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[test]" })
    mockAddNotificationReceivedListener.mockReset()
    mockAddNotificationReceivedListener.mockImplementation((listener) => {
      notificationReceivedListener = listener
      return {
        remove: jest.fn()
      }
    })
    mockAddNotificationResponseReceivedListener.mockReset()
    mockAddNotificationResponseReceivedListener.mockImplementation((listener) => {
      notificationResponseListener = listener
      return {
        remove: jest.fn()
      }
    })
    mockRouterPush.mockReset()
    mockRouterReplace.mockReset()
    notificationReceivedListener = null
    notificationResponseListener = null
  })

  afterEach(() => {
    appStateAddEventListenerSpy.mockRestore()
    linkingAddEventListenerSpy.mockRestore()
    linkingGetInitialUrlSpy.mockRestore()
  })

  it("bumps workspace version when a lead realtime event arrives", async () => {
    const screen = render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("session-user").props.children).toBe("agent-1")
    })

    const leadChangeCallback = mockChannel.on.mock.calls.find(
      ([type, filter]) =>
        type === "postgres_changes" &&
        filter?.schema === "public" &&
        filter?.table === "leads"
    )?.[2]

    expect(leadChangeCallback).toBeDefined()
    expect(screen.getByTestId("workspace-version").props.children).toBe(0)

    await act(async () => {
      leadChangeCallback?.({
        eventType: "INSERT",
        new: { id: "lead-2", agent_id: "agent-1" }
      })
    })

    expect(screen.getByTestId("workspace-version").props.children).toBe(1)
    expect(mockSupabaseChannel).toHaveBeenCalledWith("mobile-workspace-agent-1")
  })

  it("subscribes to agent-scoped appointment realtime changes", async () => {
    render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(mockSupabaseChannel).toHaveBeenCalledWith("mobile-workspace-agent-1")
    })

    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        schema: "public",
        table: "appointments",
        filter: "agent_id=eq.agent-1"
      }),
      expect.any(Function)
    )
  })

  it("registers push tokens, tracks unread new leads, and routes notification taps", async () => {
    const screen = render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("unread-new-leads").props.children).toBe(1)
    })

    expect(mockGetDashboardSummary).toHaveBeenCalled()
    expect(mockListNewLeads).not.toHaveBeenCalled()
    expect(mockRegisterPushToken).toHaveBeenCalledWith({
      expoPushToken: "ExponentPushToken[test]",
      platform: expect.any(String)
    })
    expect(mockSubmitConsentRecords).toHaveBeenCalledWith({
      records: [
        expect.objectContaining({
          id: expect.stringMatching(UUID_PATTERN),
          subjectType: "agent",
          consentType: "push_notifications",
          status: "granted",
          source: "mobile-session-provider",
          metadata: {
            permissionStatus: "granted"
          }
        })
      ]
    })
    expect(mockSubmitProductEvents).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({
          id: expect.stringMatching(UUID_PATTERN),
          eventName: "notification.token_registered",
          resourceType: "notification",
          platform: expect.any(String),
          properties: {
            permissionStatus: "granted"
          }
        })
      ]
    })

    await act(async () => {
      notificationResponseListener?.({
        notification: {
          request: {
            content: {
              data: {
                route: "/(app)/new-leads"
              }
            }
          }
        }
      })
    })

    expect(mockRouterPush).toHaveBeenCalledWith("/new-leads")
  })

  it("keeps first-party event IDs as UUIDs when Web Crypto is unavailable", async () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto")
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined
    })

    try {
      render(
        <SessionProvider>
          <SessionValueProbe />
        </SessionProvider>
      )

      await waitFor(() => {
        expect(mockSubmitProductEvents).toHaveBeenCalledTimes(1)
      })

      const consentPayload = mockSubmitConsentRecords.mock.calls[0]?.[0]
      const productPayload = mockSubmitProductEvents.mock.calls[0]?.[0]

      expect(consentPayload.records[0].id).toMatch(UUID_PATTERN)
      expect(productPayload.events[0].id).toMatch(UUID_PATTERN)
      expect(mockRandomUUID).toHaveBeenCalledTimes(2)
    } finally {
      if (cryptoDescriptor) {
        Object.defineProperty(globalThis, "crypto", cryptoDescriptor)
      } else {
        delete (globalThis as { crypto?: Crypto }).crypto
      }
    }
  })

  it("refreshes workspace state when a new-lead notification arrives in the foreground", async () => {
    mockGetDashboardSummary
      .mockResolvedValueOnce({
        totalLeads: 0,
        newLeads: 0,
        readyToShow: 0,
        appointmentBooked: 0,
        nurture: 0,
        hold: 0,
        averageScore: 0
      })
      .mockResolvedValueOnce({
        totalLeads: 1,
        newLeads: 1,
        readyToShow: 0,
        appointmentBooked: 0,
        nurture: 0,
        hold: 0,
        averageScore: 0
      })

    const screen = render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("unread-new-leads").props.children).toBe(0)
    })

    await waitFor(() => {
      expect(mockAddNotificationReceivedListener).toHaveBeenCalledTimes(1)
    })

    const receivedCallback = mockAddNotificationReceivedListener.mock.calls[0]?.[0]

    await act(async () => {
      receivedCallback?.({
        request: {
          content: {
            data: {
              route: "/(app)/new-leads"
            }
          }
        }
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId("workspace-version").props.children).toBe(1)
    })

    await waitFor(() => {
      expect(screen.getByTestId("unread-new-leads").props.children).toBe(1)
    })
  })

  it("starts and stops Supabase auto-refresh with the app state", async () => {
    const screen = render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("session-user").props.children).toBe("agent-1")
    })

    expect(mockStartAutoRefresh).toHaveBeenCalledTimes(1)

    await act(async () => {
      appStateChangeListener?.("background")
    })

    expect(mockStopAutoRefresh).toHaveBeenCalled()

    await act(async () => {
      appStateChangeListener?.("active")
    })

    expect(mockStartAutoRefresh).toHaveBeenCalledTimes(2)
  })

  it("clears a stale stored session when Supabase cannot refresh it during bootstrap", async () => {
    const staleRefreshError = new Error("Invalid Refresh Token: Refresh Token Not Found")
    mockGetSession.mockResolvedValue({
      data: {
        session: null
      },
      error: staleRefreshError
    })

    const screen = render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("session-user").props.children).toBe("none")
    })

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" })
    expect(mockStopAutoRefresh).toHaveBeenCalled()
    expect(mockCaptureDiagnosticsError).toHaveBeenCalledWith(
      staleRefreshError,
      expect.objectContaining({
        category: "auth",
        severity: "warning"
      })
    )
  })

  it("still clears a stale stored session when diagnostics reporting fails", async () => {
    mockCaptureDiagnosticsError.mockRejectedValue(new Error("Diagnostics unavailable"))
    mockGetSession.mockResolvedValue({
      data: {
        session: null
      },
      error: new Error("Invalid Refresh Token: Refresh Token Not Found")
    })

    const screen = render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("session-user").props.children).toBe("none")
    })

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" })
    expect(mockStopAutoRefresh).toHaveBeenCalled()
  })

  it("marks password recovery pending when the callback route restores a recovery session", async () => {
    mockRestoreSessionFromUrl.mockResolvedValue({
      restored: true,
      kind: "password-recovery"
    })

    const screen = render(
      <SessionProvider>
        <RestoreAuthLinkProbe url="showready://auth/callback?type=recovery" />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("password-recovery-pending").props.children).toBe("no")
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("restore-auth-link"))
    })

    await waitFor(() => {
      expect(screen.getByTestId("password-recovery-pending").props.children).toBe("yes")
    })

    expect(mockRestoreSessionFromUrl).toHaveBeenCalledWith(
      "showready://auth/callback?type=recovery"
    )
    expect(mockSetStoredPasswordRecoveryPending).toHaveBeenCalledTimes(1)
    expect(mockRouterReplace).toHaveBeenCalledWith("/reset-password")
  })

  it("restores incoming auth callback URL events before router navigation", async () => {
    const restoredSession = {
      access_token: "access-token",
      user: {
        id: "agent-restored"
      }
    }

    mockGetSession
      .mockResolvedValueOnce({
        data: {
          session: null
        }
      })
      .mockResolvedValue({
        data: {
          session: restoredSession
        }
      })
    mockRestoreSessionFromUrl.mockResolvedValue({
      restored: true,
      kind: "sign-in"
    })

    const screen = render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("session-user").props.children).toBe("none")
    })

    await act(async () => {
      linkingUrlListener?.({
        url: "showready://auth/callback?access_token=access-token&refresh_token=refresh-token"
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId("session-user").props.children).toBe("agent-restored")
    })

    expect(mockRestoreSessionFromUrl).toHaveBeenCalledWith(
      "showready://auth/callback?access_token=access-token&refresh_token=refresh-token"
    )
  })

  it("restores password recovery pending state across app restarts without app side effects", async () => {
    mockGetStoredPasswordRecoveryPending.mockResolvedValue(true)

    const screen = render(
      <SessionProvider>
        <SessionValueProbe />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("password-recovery-pending").props.children).toBe("yes")
    })

    expect(mockRouterReplace).toHaveBeenCalledWith("/reset-password")
    expect(mockSupabaseChannel).not.toHaveBeenCalled()
    expect(mockGetDashboardSummary).not.toHaveBeenCalled()
    expect(mockRegisterPushToken).not.toHaveBeenCalled()
  })

  it("routes invalid password recovery links back to sign-in feedback", async () => {
    mockRestoreSessionFromUrl.mockResolvedValue({
      restored: false,
      reason: "password-recovery-invalid",
      message: "Email link is invalid or has expired"
    })

    const screen = render(
      <SessionProvider>
        <RestoreAuthLinkProbe url="showready://auth/callback?error_code=otp_expired" />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("restore-auth-link"))
    })

    expect(mockClearStoredPasswordRecoveryPending).toHaveBeenCalledTimes(1)
    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/(auth)/sign-in",
      params: {
        reset: "invalid"
      }
    })
  })

  it("routes password recovery deep links to the reset password screen", async () => {
    mockRestoreSessionFromUrl.mockResolvedValue({
      restored: true,
      kind: "password-recovery"
    })

    const screen = render(
      <SessionProvider>
        <RestoreAuthLinkProbe url="showready://auth/callback?type=recovery" />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("password-recovery-pending").props.children).toBe("no")
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("restore-auth-link"))
    })

    expect(screen.getByTestId("password-recovery-pending").props.children).toBe("yes")
    expect(mockRouterReplace).toHaveBeenCalledWith("/reset-password")
  })
})
