import { beforeEach, describe, expect, it, vi } from "vitest"
import AccountDeletionPage from "./account-deletion/page"
import PrivacyPage from "./privacy/page"
import SupportPage from "./support/page"
import TermsPage from "./terms/page"

const { permanentRedirectMock } = vi.hoisted(() => ({
  permanentRedirectMock: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  permanentRedirect: permanentRedirectMock,
}))

describe("legacy public page redirects", () => {
  beforeEach(() => permanentRedirectMock.mockReset())
  it.each([
    [SupportPage, "https://showreadyapp.com/support"],
    [PrivacyPage, "https://showreadyapp.com/privacy"],
    [TermsPage, "https://showreadyapp.com/terms"],
    [AccountDeletionPage, "https://showreadyapp.com/account-deletion"],
  ])("redirects to a fixed canonical target", (Page, target) => {
    Page()
    expect(permanentRedirectMock).toHaveBeenCalledOnce()
    expect(permanentRedirectMock).toHaveBeenCalledWith(target)
  })
})
