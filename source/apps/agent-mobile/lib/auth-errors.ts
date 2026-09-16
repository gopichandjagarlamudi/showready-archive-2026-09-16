export const AUTH_NETWORK_ERROR_MESSAGE =
  "We could not reach ShowReady. Check your internet connection and try again."

const NETWORK_ERROR_PATTERNS = [
  "authretryablefetcherror",
  "failed to fetch",
  "load failed",
  "network request failed",
  "networkerror",
  "the internet connection appears to be offline",
  "timed out"
]

function getErrorName(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error
    ? String((error as { name?: unknown }).name ?? "")
    : ""
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return ""
}

function isNetworkError(error: unknown, message: string) {
  const haystack = `${getErrorName(error)} ${message}`.toLowerCase()
  return NETWORK_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern))
}

export function getFriendlyAuthErrorMessage(
  error: unknown,
  fallback = "Unable to complete authentication right now."
) {
  const message = getErrorMessage(error).trim()

  if (isNetworkError(error, message)) {
    return AUTH_NETWORK_ERROR_MESSAGE
  }

  return message || fallback
}
