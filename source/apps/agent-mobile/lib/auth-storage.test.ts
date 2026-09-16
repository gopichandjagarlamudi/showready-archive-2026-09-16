describe("authStorage", () => {
  let originalPlatformOS: string
  let originalLocalStorage: Storage | undefined

  beforeEach(() => {
    jest.resetModules()
    jest.unmock("react-native")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native")
    originalPlatformOS = Platform.OS
    originalLocalStorage = globalThis.localStorage
  })

  afterEach(() => {
    jest.dontMock("expo-secure-store")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native")
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS
    })

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage
    })
  })

  it("uses localStorage instead of SecureStore on web", async () => {
    const getItem = jest.fn(() => "stored-session")
    const setItem = jest.fn()
    const removeItem = jest.fn()

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem,
        setItem,
        removeItem
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native")
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web"
    })

    const secureStore = {
      getItemAsync: jest.fn(async () => "secure-session"),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn()
    }

    jest.doMock("expo-secure-store", () => secureStore)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { authStorage } = require("./auth-storage")

    await expect(authStorage.getItem("supabase-auth")).resolves.toBe("stored-session")
    await authStorage.setItem("supabase-auth", "next-session")
    await authStorage.removeItem("supabase-auth")

    expect(getItem).toHaveBeenCalledWith("supabase-auth")
    expect(setItem).toHaveBeenCalledWith("supabase-auth", "next-session")
    expect(removeItem).toHaveBeenCalledWith("supabase-auth")
    expect(secureStore.getItemAsync).not.toHaveBeenCalled()
    expect(secureStore.setItemAsync).not.toHaveBeenCalled()
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled()
  })

  it("uses a keychain accessibility level that supports background refresh after first unlock", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native")
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios"
    })

    const secureStore = {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 2,
      getItemAsync: jest.fn(async () => "secure-session"),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn()
    }

    jest.doMock("expo-secure-store", () => secureStore)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { authStorage } = require("./auth-storage")

    await expect(authStorage.getItem("supabase-auth")).resolves.toBe("secure-session")
    await authStorage.setItem("supabase-auth", "next-session")
    await authStorage.removeItem("supabase-auth")

    const secureStoreOptions = {
      keychainAccessible: secureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
    }

    expect(secureStore.getItemAsync).toHaveBeenCalledWith("supabase-auth", secureStoreOptions)
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      "supabase-auth",
      "next-session",
      secureStoreOptions
    )
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("supabase-auth", secureStoreOptions)
  })

  it("treats native keychain interaction-blocked reads as a missing session", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native")
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios"
    })

    const secureStore = {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 2,
      getItemAsync: jest.fn(async () => {
        throw new Error(
          "Calling the 'getValueWithKeyAsync' function has failed\nCaused by: User interaction is not allowed."
        )
      }),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn()
    }

    jest.doMock("expo-secure-store", () => secureStore)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { authStorage } = require("./auth-storage")

    await expect(authStorage.getItem("supabase-auth")).resolves.toBeNull()
  })
})
