import {
  AUTH_NETWORK_ERROR_MESSAGE,
  getFriendlyAuthErrorMessage
} from "./auth-errors"

describe("auth error messages", () => {
  it("maps thrown network failures to connection guidance", () => {
    expect(getFriendlyAuthErrorMessage(new TypeError("Network request failed"))).toBe(
      AUTH_NETWORK_ERROR_MESSAGE
    )
  })

  it("maps retryable Supabase fetch errors to connection guidance", () => {
    const error = new Error("fetch failed")
    error.name = "AuthRetryableFetchError"

    expect(getFriendlyAuthErrorMessage(error)).toBe(AUTH_NETWORK_ERROR_MESSAGE)
  })

  it("keeps specific auth service messages", () => {
    expect(getFriendlyAuthErrorMessage(new Error("Invalid login credentials"))).toBe(
      "Invalid login credentials"
    )
  })

  it("uses a fallback when the thrown value has no readable message", () => {
    expect(getFriendlyAuthErrorMessage(null, "Unable to sign in right now.")).toBe(
      "Unable to sign in right now."
    )
  })
})
