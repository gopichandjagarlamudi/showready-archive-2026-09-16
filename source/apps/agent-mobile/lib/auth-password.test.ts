describe("password recovery helpers", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.doMock("./supabase", () => ({
      supabase: {
        auth: {}
      }
    }))
  })

  it("requests a password reset email through the mobile auth bridge", async () => {
    jest.doMock("./auth-oauth", () => ({
      getMobileAuthBridgeUrl: jest.fn(() => "https://showready.example/auth/mobile-callback")
    }))

    const resetPasswordForEmail = jest.fn(async () => ({ data: {}, error: null }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestPasswordResetEmail } = require("./auth-password")

    await expect(
      requestPasswordResetEmail(" agent@example.com ", {
        auth: {
          resetPasswordForEmail
        }
      })
    ).resolves.toEqual({ type: "success" })

    expect(resetPasswordForEmail).toHaveBeenCalledWith("agent@example.com", {
      redirectTo: "https://showready.example/auth/mobile-callback"
    })
  })

  it("returns Supabase reset request errors", async () => {
    jest.doMock("./auth-oauth", () => ({
      getMobileAuthBridgeUrl: jest.fn(() => "https://showready.example/auth/mobile-callback")
    }))

    const resetPasswordForEmail = jest.fn(async () => ({
      data: null,
      error: new Error("Email rate limit exceeded.")
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestPasswordResetEmail } = require("./auth-password")

    await expect(
      requestPasswordResetEmail("agent@example.com", {
        auth: {
          resetPasswordForEmail
        }
      })
    ).resolves.toEqual({ type: "error", message: "Email rate limit exceeded." })
  })

  it("returns friendly reset request feedback when the network is unavailable", async () => {
    jest.doMock("./auth-oauth", () => ({
      getMobileAuthBridgeUrl: jest.fn(() => "https://showready.example/auth/mobile-callback")
    }))

    const resetPasswordForEmail = jest.fn(async () => {
      throw new TypeError("Network request failed")
    })

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestPasswordResetEmail } = require("./auth-password")

    await expect(
      requestPasswordResetEmail("agent@example.com", {
        auth: {
          resetPasswordForEmail
        }
      })
    ).resolves.toEqual({
      type: "error",
      message: "We could not reach ShowReady. Check your internet connection and try again."
    })
  })

  it("updates a recovered password and clears the temporary local session", async () => {
    const updateUser = jest.fn(async () => ({ data: {}, error: null }))
    const signOut = jest.fn(async () => ({ error: null }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { updateRecoveredPassword } = require("./auth-password")

    await expect(
      updateRecoveredPassword("new-secure-password", {
        auth: {
          updateUser,
          signOut
        }
      })
    ).resolves.toEqual({ type: "success" })

    expect(updateUser).toHaveBeenCalledWith({ password: "new-secure-password" })
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("does not sign out when the password update fails", async () => {
    const updateUser = jest.fn(async () => ({
      data: null,
      error: new Error("Password should be at least 6 characters.")
    }))
    const signOut = jest.fn(async () => ({ error: null }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { updateRecoveredPassword } = require("./auth-password")

    await expect(
      updateRecoveredPassword("short", {
        auth: {
          updateUser,
          signOut
        }
      })
    ).resolves.toEqual({
      type: "error",
      message: "Password should be at least 6 characters."
    })

    expect(signOut).not.toHaveBeenCalled()
  })

  it("persists and clears the pending password recovery marker", async () => {
    const storage = {
      getItem: jest.fn(async () => "true"),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => undefined)
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      clearStoredPasswordRecoveryPending,
      getStoredPasswordRecoveryPending,
      setStoredPasswordRecoveryPending
    } = require("./auth-password")

    await expect(getStoredPasswordRecoveryPending(storage)).resolves.toBe(true)
    await setStoredPasswordRecoveryPending(storage)
    await clearStoredPasswordRecoveryPending(storage)

    expect(storage.getItem).toHaveBeenCalledWith("showready-password-recovery-pending")
    expect(storage.setItem).toHaveBeenCalledWith("showready-password-recovery-pending", "true")
    expect(storage.removeItem).toHaveBeenCalledWith("showready-password-recovery-pending")
  })
})
