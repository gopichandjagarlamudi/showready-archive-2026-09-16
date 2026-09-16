import { getLegalUrl } from "./legal"

describe("legal URLs", () => {
  const originalSiteUrl = process.env.EXPO_PUBLIC_SITE_URL
  const originalApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL
  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.EXPO_PUBLIC_SITE_URL
    } else {
      process.env.EXPO_PUBLIC_SITE_URL = originalSiteUrl
    }
    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalApiUrl
    }
  })

  it("uses the public site independently of the API origin", () => {
    process.env.EXPO_PUBLIC_SITE_URL = "https://showreadyapp.com"
    process.env.EXPO_PUBLIC_API_BASE_URL =
      "https://showready-intake-web.vercel.app"
    expect(getLegalUrl("privacy")).toBe("https://showreadyapp.com/privacy")
    expect(getLegalUrl("terms")).toBe("https://showreadyapp.com/terms")
    expect(getLegalUrl("support")).toBe("https://showreadyapp.com/support")
    expect(getLegalUrl("accountDeletion")).toBe(
      "https://showreadyapp.com/account-deletion",
    )
  })
})
