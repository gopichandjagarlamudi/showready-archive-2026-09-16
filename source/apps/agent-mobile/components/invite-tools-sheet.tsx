import { useEffect, useRef, useState } from "react"
import * as Clipboard from "expo-clipboard"
import { Share, StyleSheet, Text, View } from "react-native"
import { ActionButton } from "@/components/ui/action-button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { InlineMessage } from "@/components/ui/inline-message"
import { mobileTheme } from "@/lib/theme"
import { useMobileApi, useSession } from "@/providers/session-provider"

function getRealtorInviteName(metadata: Record<string, unknown> | null | undefined) {
  const fullName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name.trim()
      : typeof metadata?.name === "string"
        ? metadata.name.trim()
        : ""

  return fullName || "Your realtor"
}

function buildInviteClipboardText(inviteUrl: string, realtorName: string) {
  return `${realtorName} has invited you to complete your ShowReady intake form. Please submit your information here: ${inviteUrl}`
}

export function InviteToolsSheet({
  visible,
  onClose,
  testID = "invite-sheet"
}: {
  visible: boolean
  onClose: () => void
  testID?: string
}) {
  const { session } = useSession()
  const api = useMobileApi()
  const sessionRealtorName = getRealtorInviteName(session?.user.user_metadata)
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null)
  const [latestInviteAgentName, setLatestInviteAgentName] = useState<string | null>(null)
  const [hasCopiedInvite, setHasCopiedInvite] = useState(false)
  const [message, setMessage] = useState<{
    tone: "success" | "error"
    title: string
    message: string
  } | null>(null)
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      clearCopyFeedbackTimer()
    }
  }, [])

  function clearCopyFeedbackTimer() {
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current)
      copyFeedbackTimerRef.current = null
    }
  }

  function resetCopyFeedback() {
    clearCopyFeedbackTimer()
    setHasCopiedInvite(false)
  }

  function showCopyFeedback() {
    clearCopyFeedbackTimer()
    setHasCopiedInvite(true)
    copyFeedbackTimerRef.current = setTimeout(() => {
      setHasCopiedInvite(false)
      copyFeedbackTimerRef.current = null
    }, 2000)
  }

  function handleClose() {
    resetCopyFeedback()
    onClose()
  }

  async function handleCreateInvite() {
    resetCopyFeedback()
    setIsCreatingInvite(true)
    setMessage(null)

    try {
      const invite = await api.createInvite()
      setLatestInviteUrl(invite.shareUrl)
      setLatestInviteAgentName(invite.agentName ?? null)
      setMessage({
        tone: "success",
        title: "Invite ready",
        message: "A fresh intake link is ready to copy or share."
      })
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to create invite",
        message: error instanceof Error ? error.message : "Try again."
      })
    } finally {
      setIsCreatingInvite(false)
    }
  }

  async function handleCopyInvite() {
    if (!latestInviteUrl) {
      return
    }

    try {
      const realtorName = latestInviteAgentName?.trim() || sessionRealtorName
      await Clipboard.setStringAsync(buildInviteClipboardText(latestInviteUrl, realtorName))
      showCopyFeedback()
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to copy invite",
        message: error instanceof Error ? error.message : "Try again."
      })
    }
  }

  async function handleShareInvite() {
    if (!latestInviteUrl) {
      return
    }

    try {
      await Share.share({
        message: latestInviteUrl,
        url: latestInviteUrl
      })
    } catch (error) {
      setMessage({
        tone: "error",
        title: "Unable to share invite",
        message: error instanceof Error ? error.message : "Try again."
      })
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title="Invite tools"
      testID={testID}
    >
      {message ? (
        <InlineMessage tone={message.tone} title={message.title} message={message.message} />
      ) : null}
      {latestInviteUrl ? (
        <>
          <View style={styles.generatedInvite}>
            <Text selectable style={styles.generatedInviteUrl}>
              {latestInviteUrl}
            </Text>
          </View>
          <View style={styles.actionStack}>
            <ActionButton
              label={isCreatingInvite ? "Creating invite..." : "Refresh invite"}
              icon="refresh-cw"
              onPress={() => {
                void handleCreateInvite()
              }}
              disabled={isCreatingInvite}
              testID="invite-button"
            />
            <ActionButton
              label={hasCopiedInvite ? "Copied to clipboard" : "Copy link"}
              icon={hasCopiedInvite ? "check" : "copy"}
              tone="secondary"
              onPress={() => {
                void handleCopyInvite()
              }}
              testID="copy-invite-button"
            />
            <ActionButton
              label="Share link"
              icon="share"
              tone="secondary"
              onPress={() => {
                void handleShareInvite()
              }}
              testID="share-invite-button"
            />
          </View>
        </>
      ) : (
        <View style={styles.actionStack}>
          <ActionButton
            label={isCreatingInvite ? "Creating invite..." : "Create invite"}
            icon="link"
            onPress={() => {
              void handleCreateInvite()
            }}
            disabled={isCreatingInvite}
            testID="invite-button"
          />
        </View>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  generatedInvite: {
    borderRadius: mobileTheme.radii.control,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    padding: 16
  },
  generatedInviteUrl: {
    fontSize: 14,
    lineHeight: 22,
    color: mobileTheme.colors.ink
  },
  actionStack: {
    gap: 10
  }
})
