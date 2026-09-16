import { useState, useTransition } from "react"
import { StyleSheet } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { ActionButton } from "../../components/ui/action-button"
import { FormField } from "../../components/ui/form-field"
import { InlineMessage } from "../../components/ui/inline-message"
import { SurfaceCard } from "../../components/ui/surface-card"
import { ScreenShell } from "../../components/screen-shell"
import { getFriendlyAuthErrorMessage } from "../../lib/auth-errors"
import { getMobileAuthBridgeUrl } from "../../lib/auth-oauth"
import { captureDiagnosticsError } from "../../lib/diagnostics/service"
import { supabase } from "../../lib/supabase"

type Status =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState(() => getParamValue(params.email) ?? "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<Status>(null)
  const [isPending, startTransition] = useTransition()

  function getValidationError() {
    if (!fullName.trim()) {
      return "Enter your full name."
    }

    if (!normalizeEmail(email)) {
      return "Enter your email address."
    }

    if (!password) {
      return "Enter a password."
    }

    if (password !== confirmPassword) {
      return "Passwords do not match."
    }

    return null
  }

  function handleCreateAccount() {
    const validationError = getValidationError()

    if (validationError) {
      setStatus({ type: "error", message: validationError })
      return
    }

    const normalizedFullName = fullName.trim()
    const normalizedEmail = normalizeEmail(email)

    setStatus(null)
    startTransition(async () => {
      try {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: getMobileAuthBridgeUrl(),
            data: {
              full_name: normalizedFullName
            }
          }
        })

        if (error) {
          void captureDiagnosticsError(error, {
            eventType: "auth.event",
            category: "auth",
            severity: "error",
            context: {
              method: "password-sign-up"
            }
          })
          setStatus({
            type: "error",
            message: getFriendlyAuthErrorMessage(
              error,
              "Unable to create your account right now."
            )
          })
          return
        }

        setStatus({
          type: "success",
          message: "Check your email to confirm your account, then sign in."
        })
      } catch (error) {
        void captureDiagnosticsError(error, {
          eventType: "auth.event",
          category: "auth",
          severity: "error",
          context: {
            method: "password-sign-up"
          }
        })
        setStatus({
          type: "error",
          message: getFriendlyAuthErrorMessage(
            error,
            "Unable to create your account right now."
          )
        })
      }
    })
  }

  return (
    <ScreenShell
      title="Create account"
      testID="sign-up-screen"
      leadingAction={{
        icon: "chevron-left",
        label: "Back to sign in",
        onPress: () => router.back()
      }}
    >
      <SurfaceCard style={styles.card}>
        {status ? (
          <InlineMessage
            tone={status.type === "success" ? "success" : "error"}
            title={status.type === "success" ? "Check your email" : "Account unavailable"}
            message={status.message}
          />
        ) : null}
        <FormField
          label="Full name"
          testID="sign-up-full-name-input"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Alex Agent"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
        <FormField
          label="Email"
          testID="sign-up-email-input"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="agent@example.com"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <FormField
          label="Password"
          testID="sign-up-password-input"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <FormField
          label="Confirm password"
          testID="sign-up-confirm-password-input"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <ActionButton
          testID="create-account-button"
          disabled={isPending}
          onPress={handleCreateAccount}
          label="Create account"
          icon="user-plus"
        />
      </SurfaceCard>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 14
  }
})
