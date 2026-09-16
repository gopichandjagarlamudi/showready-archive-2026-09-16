import type { DiagnosticsStorage } from "./store"
import { createResilientDiagnosticsStorage } from "./resilient-storage"

describe("createResilientDiagnosticsStorage", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("falls back to in-memory storage when the primary storage throws", async () => {
    const primaryStorage: DiagnosticsStorage = {
      getItem: jest.fn(async () => {
        throw new Error("Native module is null")
      }),
      setItem: jest.fn(async () => {
        throw new Error("Native module is null")
      }),
      removeItem: jest.fn(async () => {
        throw new Error("Native module is null")
      })
    }

    const storage = createResilientDiagnosticsStorage(primaryStorage)

    await expect(storage.getItem("diagnostics")).resolves.toBeNull()

    await expect(storage.setItem("diagnostics", "queued")).resolves.toBeUndefined()
    await expect(storage.getItem("diagnostics")).resolves.toBe("queued")

    await expect(storage.removeItem("diagnostics")).resolves.toBeUndefined()
    await expect(storage.getItem("diagnostics")).resolves.toBeNull()
  })

  it("does not log raw storage errors that may contain sensitive values", async () => {
    const primaryStorage: DiagnosticsStorage = {
      getItem: jest.fn(async () => {
        throw new Error("Unable to read buyer@example.com token=secret-token")
      }),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => undefined)
    }

    const storage = createResilientDiagnosticsStorage(primaryStorage)

    await storage.getItem("diagnostics")

    expect(console.warn).toHaveBeenCalledWith(
      "[diagnostics] Persistent storage unavailable, using in-memory fallback.",
      expect.objectContaining({
        errorType: "Error"
      })
    )
    expect(JSON.stringify((console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toContain(
      "buyer@example.com"
    )
    expect(JSON.stringify((console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toContain(
      "secret-token"
    )
  })
})
