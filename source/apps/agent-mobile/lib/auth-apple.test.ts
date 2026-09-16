describe("auth apple helpers", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.unmock("expo-apple-authentication")
    jest.unmock("expo-crypto")
  })

  it("signs in with Apple using a hashed nonce for Apple and the raw nonce for Supabase", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"

    const signInAsync = jest.fn(async () => ({
      identityToken: "apple-id-token",
      email: "agent@example.com",
      fullName: {
        givenName: "Taylor",
        middleName: null,
        familyName: "Agent"
      }
    }))

    jest.doMock("expo-apple-authentication", () => ({
      __esModule: true,
      isAvailableAsync: jest.fn(async () => true),
      signInAsync,
      AppleAuthenticationScope: {
        EMAIL: "EMAIL",
        FULL_NAME: "FULL_NAME"
      }
    }))

    const randomUUID = jest.fn(() => "raw-nonce")
    const digestStringAsync = jest.fn(async () => "hashed-nonce")

    jest.doMock("expo-crypto", () => ({
      __esModule: true,
      randomUUID,
      digestStringAsync,
      CryptoDigestAlgorithm: {
        SHA256: "SHA-256"
      }
    }))

    const captureDiagnosticsError = jest.fn(async () => undefined)
    jest.doMock("./diagnostics/service", () => ({
      captureDiagnosticsError
    }))

    const signInWithIdToken = jest.fn(async () => ({
      data: {
        session: { access_token: "token" },
        user: { id: "user-1" }
      },
      error: null
    }))
    const updateUser = jest.fn(async () => ({
      data: {
        user: { id: "user-1" }
      },
      error: null
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithApple } = require("./auth-apple")

    const result = await signInWithApple({
      auth: {
        signInWithIdToken,
        updateUser
      }
    })

    expect(result).toEqual({ type: "success" })
    expect(randomUUID).toHaveBeenCalledTimes(1)
    expect(digestStringAsync).toHaveBeenCalledWith("SHA-256", "raw-nonce")
    expect(signInAsync).toHaveBeenCalledWith({
      requestedScopes: ["EMAIL", "FULL_NAME"],
      nonce: "hashed-nonce"
    })
    expect(signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: "raw-nonce"
    })
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        full_name: "Taylor Agent",
        given_name: "Taylor",
        family_name: "Agent"
      }
    })
    expect(captureDiagnosticsError).not.toHaveBeenCalled()
  })

  it("returns cancel when the user dismisses the Apple prompt", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"

    jest.doMock("expo-apple-authentication", () => ({
      __esModule: true,
      isAvailableAsync: jest.fn(async () => true),
      signInAsync: jest.fn(async () => {
        const error = new Error("Canceled")
        ;(error as Error & { code?: string }).code = "ERR_REQUEST_CANCELED"
        throw error
      }),
      AppleAuthenticationScope: {
        EMAIL: "EMAIL",
        FULL_NAME: "FULL_NAME"
      }
    }))

    jest.doMock("expo-crypto", () => ({
      __esModule: true,
      randomUUID: jest.fn(() => "raw-nonce"),
      digestStringAsync: jest.fn(async () => "hashed-nonce"),
      CryptoDigestAlgorithm: {
        SHA256: "SHA-256"
      }
    }))

    jest.doMock("./diagnostics/service", () => ({
      captureDiagnosticsError: jest.fn(async () => undefined)
    }))

    const signInWithIdToken = jest.fn()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithApple } = require("./auth-apple")

    const result = await signInWithApple({
      auth: {
        signInWithIdToken,
        updateUser: jest.fn()
      }
    })

    expect(result).toEqual({ type: "cancel" })
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })

  it("returns an error when Apple sign-in is unavailable", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"

    const signInAsync = jest.fn()

    jest.doMock("expo-apple-authentication", () => ({
      __esModule: true,
      isAvailableAsync: jest.fn(async () => false),
      signInAsync,
      AppleAuthenticationScope: {
        EMAIL: "EMAIL",
        FULL_NAME: "FULL_NAME"
      }
    }))

    jest.doMock("expo-crypto", () => ({
      __esModule: true,
      randomUUID: jest.fn(() => "raw-nonce"),
      digestStringAsync: jest.fn(async () => "hashed-nonce"),
      CryptoDigestAlgorithm: {
        SHA256: "SHA-256"
      }
    }))

    jest.doMock("./diagnostics/service", () => ({
      captureDiagnosticsError: jest.fn(async () => undefined)
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithApple } = require("./auth-apple")

    const result = await signInWithApple({
      auth: {
        signInWithIdToken: jest.fn(),
        updateUser: jest.fn()
      }
    })

    expect(result).toEqual({
      type: "error",
      message: "Apple sign-in is only available on supported iOS builds."
    })
    expect(signInAsync).not.toHaveBeenCalled()
  })

  it("rejects relay email identities before exchanging the token with Supabase", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"

    jest.doMock("expo-apple-authentication", () => ({
      __esModule: true,
      isAvailableAsync: jest.fn(async () => true),
      signInAsync: jest.fn(async () => ({
        identityToken: "apple-id-token",
        email: "agent@privaterelay.appleid.com",
        fullName: null
      })),
      AppleAuthenticationScope: {
        EMAIL: "EMAIL",
        FULL_NAME: "FULL_NAME"
      }
    }))

    jest.doMock("expo-crypto", () => ({
      __esModule: true,
      randomUUID: jest.fn(() => "raw-nonce"),
      digestStringAsync: jest.fn(async () => "hashed-nonce"),
      CryptoDigestAlgorithm: {
        SHA256: "SHA-256"
      }
    }))

    jest.doMock("./diagnostics/service", () => ({
      captureDiagnosticsError: jest.fn(async () => undefined)
    }))

    const signInWithIdToken = jest.fn()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithApple } = require("./auth-apple")

    const result = await signInWithApple({
      auth: {
        signInWithIdToken,
        updateUser: jest.fn()
      }
    })

    expect(result).toEqual({
      type: "error",
      message:
        "Apple sign-in requires sharing your real email address. Turn off Hide My Email for ShowReady and try again."
    })
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })

  it("returns an error when Apple does not provide an identity token", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"

    jest.doMock("expo-apple-authentication", () => ({
      __esModule: true,
      isAvailableAsync: jest.fn(async () => true),
      signInAsync: jest.fn(async () => ({
        identityToken: null,
        email: "agent@example.com",
        fullName: null
      })),
      AppleAuthenticationScope: {
        EMAIL: "EMAIL",
        FULL_NAME: "FULL_NAME"
      }
    }))

    jest.doMock("expo-crypto", () => ({
      __esModule: true,
      randomUUID: jest.fn(() => "raw-nonce"),
      digestStringAsync: jest.fn(async () => "hashed-nonce"),
      CryptoDigestAlgorithm: {
        SHA256: "SHA-256"
      }
    }))

    jest.doMock("./diagnostics/service", () => ({
      captureDiagnosticsError: jest.fn(async () => undefined)
    }))

    const signInWithIdToken = jest.fn()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithApple } = require("./auth-apple")

    const result = await signInWithApple({
      auth: {
        signInWithIdToken,
        updateUser: jest.fn()
      }
    })

    expect(result).toEqual({
      type: "error",
      message: "Unable to complete Apple sign-in right now."
    })
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })

  it("keeps the session when metadata persistence fails and logs the recovered error", async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key"

    jest.doMock("expo-apple-authentication", () => ({
      __esModule: true,
      isAvailableAsync: jest.fn(async () => true),
      signInAsync: jest.fn(async () => ({
        identityToken: "apple-id-token",
        email: "agent@example.com",
        fullName: {
          givenName: "Taylor",
          middleName: null,
          familyName: "Agent"
        }
      })),
      AppleAuthenticationScope: {
        EMAIL: "EMAIL",
        FULL_NAME: "FULL_NAME"
      }
    }))

    jest.doMock("expo-crypto", () => ({
      __esModule: true,
      randomUUID: jest.fn(() => "raw-nonce"),
      digestStringAsync: jest.fn(async () => "hashed-nonce"),
      CryptoDigestAlgorithm: {
        SHA256: "SHA-256"
      }
    }))

    const captureDiagnosticsError = jest.fn(async () => undefined)
    jest.doMock("./diagnostics/service", () => ({
      captureDiagnosticsError
    }))

    const signInWithIdToken = jest.fn(async () => ({
      data: {
        session: { access_token: "token" },
        user: { id: "user-1" }
      },
      error: null
    }))
    const updateError = new Error("Unable to save metadata.")
    const updateUser = jest.fn(async () => ({
      data: {
        user: { id: "user-1" }
      },
      error: updateError
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithApple } = require("./auth-apple")

    const result = await signInWithApple({
      auth: {
        signInWithIdToken,
        updateUser
      }
    })

    expect(result).toEqual({ type: "success" })
    expect(captureDiagnosticsError).toHaveBeenCalledWith(updateError, {
      eventType: "auth.event",
      category: "auth",
      severity: "error",
      context: {
        method: "apple",
        stage: "metadata"
      }
    })
  })
})
