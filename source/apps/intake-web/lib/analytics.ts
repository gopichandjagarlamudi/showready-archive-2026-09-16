export async function trackServerEvent(
  event: string,
  properties: Record<string, unknown>,
  agentId?: string
) {
  if (process.env.NODE_ENV !== "production") {
    console.info("[analytics]", { event })
  }
}
