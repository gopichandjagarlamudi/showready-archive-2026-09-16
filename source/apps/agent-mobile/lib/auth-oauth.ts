import { makeRedirectUri } from "expo-auth-session"
import * as QueryParams from "expo-auth-session/build/QueryParams"
import * as WebBrowser from "expo-web-browser"
import Constants from "expo-constants"
import { getFriendlyAuthErrorMessage } from "./auth-errors"
import { getApiBaseUrl } from "./env"
import { supabase } from "./supabase"

type OAuthClient = Pick<typeof supabase, "auth">

export type RestoredAuthLinkResult =
  | { restored: false }
  | { restored: false; reason: "password-recovery-invalid"; message: string }
  | { restored: true; kind: "sign-in" | "password-recovery" }

export type GoogleSignInResult =
  | { type: "success" }
  | { type: "cancel" }
  | { type: "error"; message: string }

WebBrowser.maybeCompleteAuthSession()

export function isAuthCallbackUrl(url: string) {
  return url.includes("auth/callback")
}

export function getGoogleRedirectUrl() {
  return getMobileAuthBridgeUrl()
}

export function getMobileAuthBridgeUrl() {
  return new URL("/auth/mobile-callback", getApiBaseUrl()).toString()
}

export function getNativeAuthCallbackUrl() {
  return makeRedirectUri({
    scheme: "showready",
    path: "auth/callback",
    native: "showready://auth/callback"
  })
}

export function isExpoGo() {
  return Constants.appOwnership === "expo"
}

function getInvalidPasswordRecoveryMessage(
  params: Record<string, string>,
  errorCode?: string | null
) {
  const recoveryErrorCode = params.error_code ?? errorCode ?? null
  const errorDescription = params.error_description
  const hasAuthError = Boolean(params.error || params.error_code || errorCode)

  if (
    (params.type === "recovery" && hasAuthError) ||
    recoveryErrorCode === "otp_expired" ||
    recoveryErrorCode === "otp_disabled"
  ) {
    return errorDescription ?? "That reset link is invalid or expired."
  }

  return null
}

export async function restoreSessionFromUrl(
  url: string,
  client: OAuthClient = supabase
): Promise<RestoredAuthLinkResult> {
  if (!isAuthCallbackUrl(url)) {
    return { restored: false }
  }

  const { params, errorCode } = QueryParams.getQueryParams(url)
  const invalidRecoveryMessage = getInvalidPasswordRecoveryMessage(params, errorCode)

  if (invalidRecoveryMessage) {
    return {
      restored: false,
      reason: "password-recovery-invalid",
      message: invalidRecoveryMessage
    }
  }

  if (errorCode) {
    throw new Error(errorCode)
  }

  if (params.error) {
    throw new Error(params.error_description ?? params.error)
  }

  const accessToken = params.access_token
  const refreshToken = params.refresh_token
  const kind = params.type === "recovery" ? "password-recovery" : "sign-in"

  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })

    if (error) {
      throw error
    }

    return { restored: true, kind }
  }

  const authCode = params.code
  if (authCode && "exchangeCodeForSession" in client.auth) {
    const exchangeCodeForSession = client.auth.exchangeCodeForSession as
      | ((
          code: string
        ) => Promise<{ data?: { redirectType?: string | null }; error: Error | null }>)
      | undefined

    if (exchangeCodeForSession) {
      const { data, error } = await exchangeCodeForSession(authCode)

      if (error) {
        throw error
      }

      return {
        restored: true,
        kind:
          kind === "password-recovery" || data?.redirectType === "PASSWORD_RECOVERY"
            ? "password-recovery"
            : "sign-in"
      }
    }
  }

  throw new Error("The auth callback did not include a usable session.")
}

export async function signInWithGoogle(
  client: OAuthClient = supabase
): Promise<GoogleSignInResult> {
  if (isExpoGo()) {
    return {
      type: "error",
      message:
        "Google sign-in requires a development build or standalone app. Expo Go cannot complete OAuth redirects for this flow."
    }
  }

  try {
    const redirectTo = getGoogleRedirectUrl()
    const nativeCallbackUrl = getNativeAuthCallbackUrl()
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    })

    if (error || !data?.url) {
      return {
        type: "error",
        message: getFriendlyAuthErrorMessage(
          error,
          "Unable to start Google sign-in right now."
        )
      }
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, nativeCallbackUrl)

    if (result.type === "cancel" || result.type === "dismiss") {
      return { type: "cancel" }
    }

    if (result.type !== "success" || !("url" in result) || !result.url) {
      return {
        type: "error",
        message: "Unable to complete Google sign-in right now."
      }
    }

    try {
      await restoreSessionFromUrl(result.url, client)
      return { type: "success" }
    } catch (restoreError) {
      return {
        type: "error",
        message: getFriendlyAuthErrorMessage(
          restoreError,
          "Unable to complete Google sign-in right now."
        )
      }
    }
  } catch (error) {
    return {
      type: "error",
      message: getFriendlyAuthErrorMessage(error, "Unable to start Google sign-in right now.")
    }
  }
}
