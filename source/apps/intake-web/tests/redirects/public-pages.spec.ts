import { expect, test } from "@playwright/test"

for (const [path, target] of [
  ["/support", "https://showreadyapp.com/support"],
  ["/privacy", "https://showreadyapp.com/privacy"],
  ["/terms", "https://showreadyapp.com/terms"],
  ["/account-deletion", "https://showreadyapp.com/account-deletion"],
] as const) {
  test(`${path} permanently redirects without carrying query input`, async ({
    request,
  }) => {
    const response = await request.get(`${path}?utm_source=legacy`, {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(308)
    expect(response.headers().location).toBe(target)
  })
}
