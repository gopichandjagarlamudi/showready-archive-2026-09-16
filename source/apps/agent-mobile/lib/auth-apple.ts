import * as AppleAuthentication from "expo-apple-authentication"
import * as Crypto from "expo-crypto"
import { getFriendlyAuthErrorMessage } from "./auth-errors"
import { captureDiagnosticsError } from "./diagnostics/service"
import { supabase } from "./supabase"

type AppleAuthClient = Pick<typeof supabase, "auth">

export type AppleSignInResult =
  | { type: "success" }
  | { type: "cancel" }
  | { type: "error"; message: string }

const APPLE_RELAY_EMAIL_DOMAIN = "privaterelay.appleid.com"

function isAppleCancellationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
  )
}

function isRelayEmail(email: string | null | undefined) {
  if (!email) {
    return false
  }

  return email.trim().toLowerCase().endsWith(`@${APPLE_RELAY_EMAIL_DOMAIN}`)
}

function buildAppleMetadata(fullName: AppleAuthentication.AppleAuthenticationFullName | null) {
  const givenName = fullName?.givenName?.trim()
  const middleName = fullName?.middleName?.trim()
  const familyName = fullName?.familyName?.trim()
  const displayName = [givenName, middleName, familyName].filter(Boolean).join(" ")

  const data: Record<string, string> = {}

  if (displayName) {
    data.full_name = displayName
  }

  if (givenName) {
    data.given_name = givenName
  }

  if (familyName) {
    data.family_name = familyName
  }

  return Object.keys(data).length > 0 ? data : null
}

export async function isAppleSignInAvailable() {
  try {
    return await AppleAuthentication.isAvailableAsync()
  } catch {
    return false
  }
}

export async function signInWithApple(
  client: AppleAuthClient = supabase
): Promise<AppleSignInResult> {
  const isAvailable = await isAppleSignInAvailable()

  if (!isAvailable) {
    return {
      type: "error",
      message: "Apple sign-in is only available on supported iOS builds."
    }
  }

  try {
    const rawNonce = Crypto.randomUUID()
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    )

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME
      ],
      nonce: hashedNonce
    })

    if (isRelayEmail(credential.email)) {
      return {
        type: "error",
        message:
          "Apple sign-in requires sharing your real email address. Turn off Hide My Email for ShowReady and try again."
      }
    }

    if (!credential.identityToken) {
      return {
        type: "error",
        message: "Unable to complete Apple sign-in right now."
      }
    }

    const { error: signInError } = await client.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce
    })

    if (signInError) {
      return {
        type: "error",
        message: getFriendlyAuthErrorMessage(
          signInError,
          "Unable to complete Apple sign-in right now."
        )
      }
    }

    const metadata = buildAppleMetadata(credential.fullName)
    if (metadata) {
      const { error: metadataError } = await client.auth.updateUser({
        data: metadata
      })

      if (metadataError) {
        try {
          await captureDiagnosticsError(metadataError, {
            eventType: "auth.event",
            category: "auth",
            severity: "error",
            context: {
              method: "apple",
              stage: "metadata"
            }
          })
        } catch {
          // Keep Apple sign-in successful even if diagnostics transport is unavailable.
        }
      }
    }

    return { type: "success" }
  } catch (error) {
    if (isAppleCancellationError(error)) {
      return { type: "cancel" }
    }

    return {
      type: "error",
      message: getFriendlyAuthErrorMessage(error, "Unable to complete Apple sign-in right now.")
    }
  }
}
