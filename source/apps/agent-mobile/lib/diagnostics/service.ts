import type {
  DiagnosticsCategory,
  DiagnosticsEventType,
  DiagnosticsMetadata,
  DiagnosticsSeverity
} from "@showready/contracts"
import type { createMobileApiClient } from "@showready/infrastructure"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import { Platform } from "react-native"
import { createResilientDiagnosticsStorage } from "./resilient-storage"
import { createDiagnosticsRuntime } from "./runtime"
import { createDiagnosticsStore } from "./store"

type DiagnosticsApiClient = Pick<ReturnType<typeof createMobileApiClient>, "submitDiagnostics">

type LogDiagnosticsInput = {
  eventType: DiagnosticsEventType
  category: DiagnosticsCategory
  severity: DiagnosticsSeverity
  message: string
  fingerprint?: string
  requestPath?: string
  httpStatus?: number
  leadId?: string
  appointmentId?: string
  pipelineStage?: string
  context?: DiagnosticsMetadata
  tags?: DiagnosticsMetadata
  screen?: string
}

type CaptureDiagnosticsErrorInput = Omit<LogDiagnosticsInput, "message">

type GlobalErrorUtils = {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void
}

const diagnosticsStore = createDiagnosticsStore({
  storage: createResilientDiagnosticsStorage(AsyncStorage)
})

let diagnosticsApiClient: DiagnosticsApiClient | null = null
let currentScreen: string | undefined
let isDiagnosticsInitialized = false
let hasInstalledGlobalHandler = false

const diagnosticsRuntime = createDiagnosticsRuntime({
  store: diagnosticsStore,
  transport: {
    submitDiagnostics: async (batch) => {
      if (!diagnosticsApiClient) {
        throw new Error("Diagnostics transport is not ready.")
      }

      return diagnosticsApiClient.submitDiagnostics(batch)
    }
  },
  platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown",
  appVersion: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? undefined,
  buildNumber: Constants.nativeBuildVersion ?? undefined
})

function withCurrentScreen<T extends { screen?: string }>(input: T): T {
  if (input.screen || !currentScreen) {
    return input
  }

  return {
    ...input,
    screen: currentScreen
  }
}

function installGlobalDiagnosticsHandler() {
  if (hasInstalledGlobalHandler) {
    return
  }

  const errorUtils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils

  if (!errorUtils?.setGlobalHandler) {
    return
  }

  const previousHandler = errorUtils.getGlobalHandler?.()

  errorUtils.setGlobalHandler((error, isFatal) => {
    void captureDiagnosticsError(error, {
      eventType: "error.unhandled",
      category: "error",
      severity: isFatal ? "fatal" : "error",
      context: {
        isFatal: Boolean(isFatal)
      }
    }).finally(() => {
      previousHandler?.(error, isFatal)
    })
  })

  hasInstalledGlobalHandler = true
}

export async function initializeDiagnostics() {
  if (!isDiagnosticsInitialized) {
    await diagnosticsRuntime.startSession()
    installGlobalDiagnosticsHandler()
    isDiagnosticsInitialized = true
    return
  }

  await diagnosticsRuntime.markSessionActive()
}

export function setDiagnosticsApiClient(apiClient: DiagnosticsApiClient | null) {
  diagnosticsApiClient = apiClient
}

export async function resumeDiagnosticsSession() {
  await diagnosticsRuntime.markSessionActive()
  await diagnosticsRuntime.flush()
}

export async function pauseDiagnosticsSession() {
  await diagnosticsRuntime.markSessionInactive()
  await diagnosticsRuntime.flush()
}

export async function flushDiagnostics() {
  return diagnosticsRuntime.flush()
}

export async function markDiagnosticsScreen(screen: string) {
  if (!screen || currentScreen === screen) {
    return
  }

  currentScreen = screen
  await diagnosticsRuntime.addBreadcrumb({
    type: "navigation",
    message: `Visited ${screen}`,
    data: {
      route: screen
    }
  })
}

export async function logDiagnosticsEvent(input: LogDiagnosticsInput) {
  await diagnosticsRuntime.logEvent(withCurrentScreen(input))

  if (input.severity === "error" || input.severity === "fatal") {
    await diagnosticsRuntime.flush()
  }
}

export async function captureDiagnosticsError(error: unknown, input: CaptureDiagnosticsErrorInput) {
  await diagnosticsRuntime.captureError(error, withCurrentScreen(input))
  await diagnosticsRuntime.flush()
}

export async function reportApiRequestError(input: {
  path: string
  method: string
  status: number
  message: string
}) {
  await logDiagnosticsEvent({
    eventType: "api.failure",
    category: "api",
    severity: "error",
    message: input.message,
    requestPath: input.path,
    httpStatus: input.status,
    context: {
      method: input.method,
      path: input.path
    }
  })
}
