export async function sendLeadScoredEmail(payload: {
  to: string
  agentName: string
  buyerName: string
  recommendation: string
  score: number
  detailUrl: string
}) {
  if (!process.env.LEAD_NOTIFICATION_WEBHOOK_URL) {
    return { skipped: true }
  }

  await fetch(process.env.LEAD_NOTIFICATION_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  return { skipped: false }
}

export async function sendLeadScoredPushNotifications(payload: {
  expoPushTokens: string[]
  title: string
  body: string
  data: {
    leadId?: string
    route: "/(app)/new-leads"
    submissionCount?: number
  }
}) {
  if (payload.expoPushTokens.length === 0) {
    return { skipped: true, sent: 0 }
  }

  const messages = payload.expoPushTokens.map((token) => ({
    to: token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data
  }))

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(messages)
  })

  if (!response.ok) {
    throw new Error("Unable to send push notifications.")
  }

  return { skipped: false, sent: messages.length }
}
