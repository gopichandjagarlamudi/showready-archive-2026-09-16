const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"])

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "")
}

function isLocalOrigin(value: string) {
  try {
    return LOCAL_HOSTNAMES.has(new URL(value).hostname)
  } catch {
    return false
  }
}

function getRequestOrigin(request?: Request) {
  if (!request) {
    return null
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()

  if (forwardedProto && forwardedHost) {
    return normalizeOrigin(`${forwardedProto}://${forwardedHost}`)
  }

  try {
    return normalizeOrigin(new URL(request.url).origin)
  } catch {
    return null
  }
}

export function buildAppUrl(pathname: string, options?: { request?: Request; appUrl?: string }) {
  const configuredBaseUrl = normalizeOrigin(
    options?.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  )
  const requestOrigin = getRequestOrigin(options?.request)
  const baseUrl =
    isLocalOrigin(configuredBaseUrl) && requestOrigin && !isLocalOrigin(requestOrigin)
      ? requestOrigin
      : configuredBaseUrl
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`

  return `${baseUrl}${normalizedPath}`
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}
