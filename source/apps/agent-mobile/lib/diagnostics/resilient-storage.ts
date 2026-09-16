import type { DiagnosticsStorage } from "./store"
import { sanitizeDiagnosticsText } from "./redaction"

function getErrorType(error: unknown) {
  if (error instanceof Error) {
    return error.name || "Error"
  }

  return typeof error === "string" ? "Error" : "Unknown"
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === "string" ? error : "Unknown error."
}

function createMemoryStorage(): DiagnosticsStorage {
  const values = new Map<string, string>()

  return {
    async getItem(key: string) {
      return values.get(key) ?? null
    },
    async setItem(key: string, value: string) {
      values.set(key, value)
    },
    async removeItem(key: string) {
      values.delete(key)
    }
  }
}

export function createResilientDiagnosticsStorage(primaryStorage: DiagnosticsStorage): DiagnosticsStorage {
  const fallbackStorage = createMemoryStorage()
  let shouldUseFallbackStorage = false
  let hasWarned = false

  function warnOnce(error: unknown) {
    if (hasWarned) {
      return
    }

    hasWarned = true
    console.warn("[diagnostics] Persistent storage unavailable, using in-memory fallback.", {
      errorType: getErrorType(error),
      message: sanitizeDiagnosticsText(getErrorMessage(error), 200)
    })
  }

  return {
    async getItem(key: string) {
      if (shouldUseFallbackStorage) {
        return fallbackStorage.getItem(key)
      }

      try {
        return await primaryStorage.getItem(key)
      } catch (error) {
        shouldUseFallbackStorage = true
        warnOnce(error)
        return fallbackStorage.getItem(key)
      }
    },

    async setItem(key: string, value: string) {
      if (shouldUseFallbackStorage) {
        return fallbackStorage.setItem(key, value)
      }

      try {
        await primaryStorage.setItem(key, value)
      } catch (error) {
        shouldUseFallbackStorage = true
        warnOnce(error)
        await fallbackStorage.setItem(key, value)
      }
    },

    async removeItem(key: string) {
      if (shouldUseFallbackStorage) {
        return fallbackStorage.removeItem(key)
      }

      try {
        await primaryStorage.removeItem(key)
      } catch (error) {
        shouldUseFallbackStorage = true
        warnOnce(error)
        await fallbackStorage.removeItem(key)
      }
    }
  }
}
