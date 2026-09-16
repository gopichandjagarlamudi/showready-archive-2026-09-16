import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockRedirect } = vi.hoisted(() => {
  const fn = vi.fn<(url: string) => never>()
  fn.mockImplementation(() => {
    const err = new Error("NEXT_REDIRECT")
    ;(err as any).digest = "NEXT_REDIRECT"
    throw err
  })
  return { mockGetUser: vi.fn(), mockRedirect: fn }
})

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: { getUser: mockGetUser }
  }))
}))

vi.mock("next/navigation", () => ({
  redirect: mockRedirect
}))

vi.mock("@/lib/env", () => ({
  getAdminOwnerEmail: () => "owner@example.com"
}))

vi.mock("server-only", () => ({}))

import { requireAdminPage } from "./auth"

describe("requireAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects anonymous visitors to sign-in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(requireAdminPage()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") })
    expect(mockRedirect).toHaveBeenCalledWith("/sign-in")
  })

  it("redirects non-owner users to access denied", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1", email: "other@example.com" } }, error: null })
    await expect(requireAdminPage()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") })
    expect(mockRedirect).toHaveBeenCalledWith("/access-denied")
  })

  it("returns the configured owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1", email: "OWNER@example.com" } }, error: null })
    await expect(requireAdminPage()).resolves.toMatchObject({ id: "u-1" })
  })
})
