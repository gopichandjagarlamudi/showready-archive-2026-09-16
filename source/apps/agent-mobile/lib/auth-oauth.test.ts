describe("auth oauth helpers", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.unmock("expo-constants")
    jest.unmock("expo-auth-session")
    jest.unmock("expo-web-browser")
  })

  it("detects auth callback urls", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000"

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isAuthCallbackUrl } = require("./auth-oauth")

    expect(isAuthCallbackUrl("showready://auth/callback?code=123")).toBe(true)
    expect(isAuthCallbackUrl("showready://dashboard")).toBe(false)
  })

  it("ignores urls that are not auth callbacks", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000"

    jest.doMock("expo-web-browser", () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn()
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { restoreSessionFromUrl } = require("./auth-oauth")

    await expect(
      restoreSessionFromUrl("showready://dashboard", {
        auth: {
          setSession: jest.fn()
        }
      })
    ).resolves.toEqual({ restored: false })
  })

  it("restores a normal auth callback as a sign-in link", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000"

    jest.doMock("expo-web-browser", () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn()
    }))

    const setSession = jest.fn(async () => ({ error: null }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { restoreSessionFromUrl } = require("./auth-oauth")

    await expect(
      restoreSessionFromUrl("showready://auth/callback?access_token=access&refresh_token=refresh", {
        auth: {
          setSession
        }
      })
    ).resolves.toEqual({ restored: true, kind: "sign-in" })

    expect(setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh"
    })
  })

  it("classifies recovery callbacks as password recovery links", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000"

    jest.doMock("expo-web-browser", () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn()
    }))

    const setSession = jest.fn(async () => ({ error: null }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { restoreSessionFromUrl } = require("./auth-oauth")

    await expect(
      restoreSessionFromUrl(
        "showready://auth/callback?type=recovery&access_token=access&refresh_token=refresh",
        {
          auth: {
            setSession
          }
        }
      )
    ).resolves.toEqual({ restored: true, kind: "password-recovery" })
  })

  it("classifies expired recovery callbacks as invalid password recovery links", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000"

    jest.doMock("expo-web-browser", () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn()
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { restoreSessionFromUrl } = require("./auth-oauth")

    await expect(
      restoreSessionFromUrl(
        "showready://auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
        {
          auth: {
            setSession: jest.fn()
          }
        }
      )
    ).resolves.toEqual({
      restored: false,
      reason: "password-recovery-invalid",
      message: "Email link is invalid or has expired"
    })
  })

  it("builds the web callback url for OAuth", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://showready-intake-web.vercel.app"
    const makeRedirectUri = jest.fn(() => "showready://auth/callback")

    jest.doMock("expo-auth-session", () => ({
      makeRedirectUri
    }))
    jest.doMock("expo-web-browser", () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn()
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getGoogleRedirectUrl } = require("./auth-oauth")

    expect(getGoogleRedirectUrl()).toBe(
      "https://showready-intake-web.vercel.app/auth/mobile-callback"
    )
    expect(makeRedirectUri).not.toHaveBeenCalled()
  })

  it("builds the native showready callback url for the in-app browser session", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://showready-intake-web.vercel.app"
    const makeRedirectUri = jest.fn(() => "showready://auth/callback")

    jest.doMock("expo-auth-session", () => ({
      makeRedirectUri
    }))
    jest.doMock("expo-web-browser", () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn()
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getNativeAuthCallbackUrl } = require("./auth-oauth")

    expect(getNativeAuthCallbackUrl()).toBe("showready://auth/callback")
    expect(makeRedirectUri).toHaveBeenCalledWith({
      scheme: "showready",
      path: "auth/callback",
      native: "showready://auth/callback"
    })
  })

  it("starts Google OAuth against the web bridge but waits for the native callback", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://showready-intake-web.vercel.app"

    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: {
        appOwnership: "standalone"
      }
    }))
    jest.doMock("expo-auth-session", () => ({
      makeRedirectUri: jest.fn(() => "showready://auth/callback")
    }))

    const openAuthSessionAsync = jest.fn(async () => ({
      type: "success",
      url: "showready://auth/callback?code=oauth-code"
    }))

    jest.doMock("expo-web-browser", () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync
    }))

    const exchangeCodeForSession = jest.fn(async () => ({ error: null }))
    const signInWithOAuth = jest.fn(async () => ({
      data: {
        url: "https://example.supabase.co/auth/v1/authorize?provider=google"
      },
      error: null
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithGoogle } = require("./auth-oauth")

    const result = await signInWithGoogle({
      auth: {
        signInWithOAuth,
        exchangeCodeForSession
      }
    })

    expect(result).toEqual({ type: "success" })
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://showready-intake-web.vercel.app/auth/mobile-callback",
        skipBrowserRedirect: true
      }
    })
    expect(openAuthSessionAsync).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/authorize?provider=google",
      "showready://auth/callback"
    )
    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code")
  })

  it("fails fast in Expo Go before starting Google OAuth", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000"

    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: {
        appOwnership: "expo"
      }
    }))
    jest.doMock("expo-auth-session", () => ({
      makeRedirectUri: jest.fn(() => "showready://auth/callback")
    }))
    jest.doMock("expo-web-browser", () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn()
    }))

    const signInWithOAuth = jest.fn()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithGoogle } = require("./auth-oauth")

    const result = await signInWithGoogle({
      auth: {
        signInWithOAuth
      }
    })

    expect(result).toEqual({
      type: "error",
      message:
        "Google sign-in requires a development build or standalone app. Expo Go cannot complete OAuth redirects for this flow."
    })
    expect(signInWithOAuth).not.toHaveBeenCalled()
  })
})
