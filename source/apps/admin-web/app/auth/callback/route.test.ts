import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mockExchangeCodeForSession = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession }
  }))
}))

import { GET } from "./route"

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exchanges code for session and redirects to /", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback?code=abc")
    const response = await GET(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc")
    expect(response.headers.get("location")).toBe("http://localhost:3000/")
  })

  it("ignores attacker-controlled redirect destinations", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback?code=abc&next=https://attacker.example")
    const response = await GET(request)

    expect(response.headers.get("location")).toBe("http://localhost:3000/")
  })

  it("redirects to / even without a code", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback")
    const response = await GET(request)

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.headers.get("location")).toBe("http://localhost:3000/")
  })
})
