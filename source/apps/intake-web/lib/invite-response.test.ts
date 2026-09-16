import { describe, expect, it } from "vitest"
import { serializeInviteResponse } from "./invite-response"

describe("serializeInviteResponse", () => {
  it("normalizes invite expiry timestamps to ISO Z format", () => {
    expect(
      serializeInviteResponse({
        token: "invite-token",
        tokenExpiresAt: "2026-04-27T03:42:55.546+00:00",
        appUrl: "http://localhost:3000"
      })
    ).toEqual({
      token: "invite-token",
      shareUrl: "http://localhost:3000/intake/invite-token",
      expiresAt: "2026-04-27T03:42:55.546Z"
    })
  })
})
