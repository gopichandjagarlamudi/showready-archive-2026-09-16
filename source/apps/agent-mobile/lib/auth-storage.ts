import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

const isWebPlatform = Platform.OS === "web"
const secureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
}

function getWebStorage() {
  if (typeof globalThis.localStorage === "undefined") {
    return null
  }

  return globalThis.localStorage
}

function isSecureStoreInteractionBlocked(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("User interaction is not allowed")
  )
}

export const authStorage = {
  async getItem(key: string) {
    if (isWebPlatform) {
      return getWebStorage()?.getItem(key) ?? null
    }

    try {
      return await SecureStore.getItemAsync(key, secureStoreOptions)
    } catch (error) {
      if (isSecureStoreInteractionBlocked(error)) {
        return null
      }

      throw error
    }
  },
  async setItem(key: string, value: string) {
    if (isWebPlatform) {
      getWebStorage()?.setItem(key, value)
      return
    }

    await SecureStore.setItemAsync(key, value, secureStoreOptions)
  },
  async removeItem(key: string) {
    if (isWebPlatform) {
      getWebStorage()?.removeItem(key)
      return
    }

    await SecureStore.deleteItemAsync(key, secureStoreOptions)
  }
}
