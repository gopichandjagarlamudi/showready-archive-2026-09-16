import { useState, useTransition } from "react"
import { StyleSheet } from "react-native"
import { router } from "expo-router"
import { ActionButton } from "../components/ui/action-button"
import { FormField } from "../components/ui/form-field"
import { InlineMessage } from "../components/ui/inline-message"
import { SurfaceCard } from "../components/ui/surface-card"
import { ScreenShell } from "../components/screen-shell"
import { updateRecoveredPassword } from "../lib/auth-password"
import { useSession } from "../providers/session-provider"

export default function ResetPasswordScreen() {
  const { passwordRecoveryPending, clearPasswordRecovery } = useSession()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function returnToSignIn(reset: "invalid" | "success") {
    router.replace({
      pathname: "/(auth)/sign-in",
      params: {
        reset
      }
    } as never)
  }

  function handleUpdatePassword() {
    if (!password) {
      setError("Enter a new password.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await updateRecoveredPassword(password)

      if (result.type === "error") {
        setError(result.message)
        return
      }

      clearPasswordRecovery()
      returnToSignIn("success")
    })
  }

  if (!passwordRecoveryPending) {
    return (
      <ScreenShell title="Reset password" testID="reset-password-screen">
        <SurfaceCard style={styles.card}>
          <InlineMessage
            tone="error"
            title="Reset link expired"
            message="This password reset link is invalid or expired."
          />
          <ActionButton
            testID="reset-password-invalid-sign-in-button"
            tone="secondary"
            onPress={() => returnToSignIn("invalid")}
            label="Back to sign in"
            icon="log-in"
          />
        </SurfaceCard>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="Reset password" testID="reset-password-screen">
      <SurfaceCard style={styles.card}>
        {error ? (
          <InlineMessage tone="error" title="Password not updated" message={error} />
        ) : null}
        <FormField
          label="New password"
          testID="new-password-input"
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <FormField
          label="Confirm password"
          testID="confirm-password-input"
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
          testID="update-password-button"
          disabled={isPending}
          onPress={handleUpdatePassword}
          label="Update password"
          icon="lock"
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
