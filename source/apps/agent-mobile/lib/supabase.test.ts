const mockCreateClient = jest.fn((_url: string, _anonKey: string, _options: unknown) => ({
  auth: {}
}))

jest.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, anonKey: string, options: unknown) =>
    mockCreateClient(url, anonKey, options)
}))

jest.mock("./env", () => ({
  getSupabaseAnonKey: jest.fn(() => "anon-key"),
  getSupabaseUrl: jest.fn(() => "https://example.supabase.co")
}))

jest.mock("./auth-storage", () => ({
  authStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  }
}))

describe("supabase client", () => {
  beforeEach(() => {
    jest.resetModules()
    mockCreateClient.mockClear()
  })

  it("leaves token auto-refresh under the mobile app lifecycle", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./supabase")

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: true
        })
      })
    )
  })
})
