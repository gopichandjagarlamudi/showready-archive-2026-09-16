import { getMobileAuthBridgeUrl } from "./auth-oauth"
import { getFriendlyAuthErrorMessage } from "./auth-errors"
import { authStorage } from "./auth-storage"
import { supabase } from "./supabase"

export const PASSWORD_RECOVERY_PENDING_KEY = "showready-password-recovery-pending"

type PasswordResetClient = {
  auth: Pick<typeof supabase.auth, "resetPasswordForEmail">
}

type PasswordUpdateClient = {
  auth: Pick<typeof supabase.auth, "updateUser" | "signOut">
}

export type PasswordRecoveryResult =
  | { type: "success" }
  | { type: "error"; message: string }

type PasswordRecoveryStorage = Pick<typeof authStorage, "getItem" | "setItem" | "removeItem">

function getAuthErrorMessage(error: unknown, fallback: string) {
  return getFriendlyAuthErrorMessage(error, fallback)
}

export async function getStoredPasswordRecoveryPending(
  storage: PasswordRecoveryStorage = authStorage
) {
  return (await storage.getItem(PASSWORD_RECOVERY_PENDING_KEY)) === "true"
}

export async function setStoredPasswordRecoveryPending(
  storage: PasswordRecoveryStorage = authStorage
) {
  await storage.setItem(PASSWORD_RECOVERY_PENDING_KEY, "true")
}

export async function clearStoredPasswordRecoveryPending(
  storage: PasswordRecoveryStorage = authStorage
) {
  await storage.removeItem(PASSWORD_RECOVERY_PENDING_KEY)
}

export async function requestPasswordResetEmail(
  email: string,
  client: PasswordResetClient = supabase
): Promise<PasswordRecoveryResult> {
  const normalizedEmail = email.trim()

  try {
    const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getMobileAuthBridgeUrl()
    })

    if (error) {
      return {
        type: "error",
        message: getAuthErrorMessage(error, "Unable to send a password reset email right now.")
      }
    }
  } catch (error) {
    return {
      type: "error",
      message: getAuthErrorMessage(error, "Unable to send a password reset email right now.")
    }
  }

  return { type: "success" }
}

export async function updateRecoveredPassword(
  password: string,
  client: PasswordUpdateClient = supabase
): Promise<PasswordRecoveryResult> {
  const { error } = await client.auth.updateUser({ password })

  if (error) {
    return {
      type: "error",
      message: getAuthErrorMessage(error, "Unable to update your password right now.")
    }
  }

  const { error: signOutError } = await client.auth.signOut({ scope: "local" })

  if (signOutError) {
    return {
      type: "error",
      message: getAuthErrorMessage(
        signOutError,
        "Your password was updated, but we could not return to sign-in."
      )
    }
  }

  await clearStoredPasswordRecoveryPending()

  return { type: "success" }
}
