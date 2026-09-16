import { beforeEach, describe, expect, it, vi } from "vitest"
import { onRequestError } from "./instrumentation"

const { mockCaptureNextRequestError } = vi.hoisted(() => ({
  mockCaptureNextRequestError: vi.fn()
}))

vi.mock("./lib/observability-edge", () => ({
  captureNextRequestError: mockCaptureNextRequestError
}))

describe("Next instrumentation", () => {
  beforeEach(() => {
    mockCaptureNextRequestError.mockReset()
    mockCaptureNextRequestError.mockResolvedValue({ requestId: "req-next" })
  })

  it("forwards uncaught Next request errors to backend observability", async () => {
    const error = new Error("Server render failed")
    const context = {
      routerKind: "App Router" as const,
      routePath: "/intake/[token]",
      routeType: "render" as const,
      renderSource: "server-rendering" as const,
      revalidateReason: undefined
    }

    await onRequestError(
      error,
      {
        path: "/intake/invite-token",
        method: "GET",
        headers: {
          "x-request-id": "req-next"
        }
      },
      context
    )

    expect(mockCaptureNextRequestError).toHaveBeenCalledWith(error, {
      path: "/intake/invite-token",
      method: "GET",
      headers: {
        "x-request-id": "req-next"
      },
      context
    })
  })
})
