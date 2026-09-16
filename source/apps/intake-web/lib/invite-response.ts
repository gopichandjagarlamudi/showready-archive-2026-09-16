import { CreateInviteResponseSchema } from "@showready/contracts"

export function serializeInviteResponse(input: {
  token: string
  tokenExpiresAt: string
  appUrl: string
  agentName?: string | null
}) {
  const normalizedAppUrl = input.appUrl.trim().replace(/\/+$/, "")
  const agentName = input.agentName?.trim()

  return CreateInviteResponseSchema.parse({
    token: input.token,
    shareUrl: `${normalizedAppUrl}/intake/${input.token}`,
    expiresAt: new Date(input.tokenExpiresAt).toISOString(),
    ...(agentName ? { agentName } : {})
  })
}
