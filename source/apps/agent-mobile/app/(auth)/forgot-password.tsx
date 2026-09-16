import { useState, useTransition } from "react"
import { StyleSheet } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { ActionButton } from "../../components/ui/action-button"
import { FormField } from "../../components/ui/form-field"
import { InlineMessage } from "../../components/ui/inline-message"
import { SurfaceCard } from "../../components/ui/surface-card"
import { ScreenShell } from "../../components/screen-shell"
import { requestPasswordResetEmail } from "../../lib/auth-password"

type Status =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>()
  const [email, setEmail] = useState(() => getParamValue(params.email) ?? "")
  const [status, setStatus] = useState<Status>(null)
  const [isPending, startTransition] = useTransition()

  function handleSendResetEmail() {
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setStatus({ type: "error", message: "Enter your email address." })
      return
    }

    setStatus(null)
    startTransition(async () => {
      const result = await requestPasswordResetEmail(normalizedEmail)

      if (result.type === "error") {
        setStatus(result)
        return
      }

      setStatus({
        type: "success",
        message: "If an account exists for that email, we sent a password reset link."
      })
    })
  }

  return (
    <ScreenShell
      title="Reset password"
      testID="forgot-password-screen"
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
            title={status.type === "success" ? "Check your email" : "Reset unavailable"}
            message={status.message}
          />
        ) : null}
        <FormField
          label="Email"
          testID="forgot-password-email-input"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="agent@example.com"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <ActionButton
          testID="send-password-reset-button"
          disabled={isPending}
          onPress={handleSendResetEmail}
          label="Send reset email"
          icon="mail"
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
