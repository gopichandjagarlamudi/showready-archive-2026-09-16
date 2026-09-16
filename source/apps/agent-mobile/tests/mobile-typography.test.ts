import { mobileTheme } from "../lib/theme"

describe("mobile typography", () => {
  it("uses an iOS-friendly type scale with a 17 point body", () => {
    expect(mobileTheme.typography.body).toBe(17)
    expect(mobileTheme.typography.bodySmall).toBe(15)
    expect(mobileTheme.typography.title).toBeGreaterThanOrEqual(30)
    expect(mobileTheme.typography.title).toBeLessThanOrEqual(34)
    expect(mobileTheme.typography.section).toBe(28)
    expect(mobileTheme.typography.eyebrow).toBe(12)
  })
})
