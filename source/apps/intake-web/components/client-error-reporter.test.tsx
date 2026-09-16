// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ClientErrorReporter } from "./client-error-reporter"

describe("ClientErrorReporter", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/intake/invite-token"
      },
      writable: true
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("reports browser runtime errors to the backend without query values or request bodies", async () => {
    render(<ClientErrorReporter />)

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Cannot read properties of undefined",
        error: new TypeError("Cannot read properties of undefined"),
        filename: "webpack://showready/components/intake-flow.tsx",
        lineno: 42,
        colno: 7
      })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/client-errors",
        expect.objectContaining({
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      eventType: "error",
      name: "TypeError",
      message: "Cannot read properties of undefined",
      path: "/intake/invite-token",
      source: "webpack://showready/components/intake-flow.tsx",
      line: 42,
      column: 7
    })
    expect(body).not.toHaveProperty("body")
  })
})
