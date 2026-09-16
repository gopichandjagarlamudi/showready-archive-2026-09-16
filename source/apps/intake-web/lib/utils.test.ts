import { afterEach, describe, expect, it } from "vitest"
import { buildAppUrl } from "./utils"

describe("buildAppUrl", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
      return
    }

    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })

  it("uses the request origin when the configured app url points at localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"

    const request = new Request("http://192.168.5.13:3000/api/mobile/invites", {
      headers: {
        host: "192.168.5.13:3000"
      }
    })

    expect(buildAppUrl("/intake/invite-token", { request })).toBe(
      "http://192.168.5.13:3000/intake/invite-token"
    )
  })

  it("prefers the configured public app url when one is provided", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://showready.example.com"

    const request = new Request("http://192.168.5.13:3000/api/mobile/invites", {
      headers: {
        host: "192.168.5.13:3000"
      }
    })

    expect(buildAppUrl("/intake/invite-token", { request })).toBe(
      "https://showready.example.com/intake/invite-token"
    )
  })
})
