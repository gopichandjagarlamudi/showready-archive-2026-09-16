import vm from "node:vm"
import { describe, expect, it, vi } from "vitest"

describe("mobile auth bridge", () => {
  it("builds a native callback url from Supabase hash tokens", async () => {
    const { buildNativeAuthCallbackUrl } = await import("./mobile-auth-bridge")

    expect(
      buildNativeAuthCallbackUrl(
        "https://showready-intake-web.vercel.app/#access_token=access&refresh_token=refresh"
      )
    ).toBe("showready://auth/callback?access_token=access&refresh_token=refresh")
  })

  it("preserves recovery callback type when building the native callback url", async () => {
    const { buildNativeAuthCallbackUrl } = await import("./mobile-auth-bridge")

    expect(
      buildNativeAuthCallbackUrl(
        "https://showready-intake-web.vercel.app/#type=recovery&access_token=access&refresh_token=refresh"
      )
    ).toBe("showready://auth/callback?type=recovery&access_token=access&refresh_token=refresh")
  })

  it("builds a native callback url from a code-based callback query string", async () => {
    const { buildNativeAuthCallbackUrl } = await import("./mobile-auth-bridge")

    expect(
      buildNativeAuthCallbackUrl(
        "https://showready-intake-web.vercel.app/auth/mobile-callback?code=oauth-code"
      )
    ).toBe("showready://auth/callback?code=oauth-code")
  })

  it("returns null when the page is not carrying auth callback params", async () => {
    const { buildNativeAuthCallbackUrl } = await import("./mobile-auth-bridge")

    expect(
      buildNativeAuthCallbackUrl("https://showready-intake-web.vercel.app/")
    ).toBeNull()
  })

  it("boots the native redirect immediately from a query-based callback without React hydration", async () => {
    const { getMobileAuthBridgeBootstrapScript } = await import("./mobile-auth-bridge")
    expect(getMobileAuthBridgeBootstrapScript).toBeTypeOf("function")
    const link = {
      href: "showready://auth/callback",
      setAttribute(name: string, value: string) {
        if (name === "href") {
          this.href = value
        }
      },
      getAttribute(name: string) {
        return name === "href" ? this.href : null
      }
    }
    const replaceSpy = vi.fn()

    vm.runInNewContext(getMobileAuthBridgeBootstrapScript(), {
      URL,
      URLSearchParams,
      window: {
        location: {
          href: "https://showready-intake-web.vercel.app/auth/mobile-callback?code=oauth-code",
          replace: replaceSpy
        }
      },
      document: {
        getElementById(id: string) {
          return id === "mobile-auth-bridge-link" ? link : null
        }
      }
    })

    expect(replaceSpy).toHaveBeenCalledWith("showready://auth/callback?code=oauth-code")
    expect(link.getAttribute("href")).toBe("showready://auth/callback?code=oauth-code")
  })

  it("boots the native redirect immediately from Supabase hash tokens without React hydration", async () => {
    const { getMobileAuthBridgeBootstrapScript } = await import("./mobile-auth-bridge")
    expect(getMobileAuthBridgeBootstrapScript).toBeTypeOf("function")
    const link = {
      href: "showready://auth/callback",
      setAttribute(name: string, value: string) {
        if (name === "href") {
          this.href = value
        }
      },
      getAttribute(name: string) {
        return name === "href" ? this.href : null
      }
    }
    const replaceSpy = vi.fn()

    vm.runInNewContext(getMobileAuthBridgeBootstrapScript(), {
      URL,
      URLSearchParams,
      window: {
        location: {
          href: "https://showready-intake-web.vercel.app/auth/mobile-callback#access_token=access&refresh_token=refresh",
          replace: replaceSpy
        }
      },
      document: {
        getElementById(id: string) {
          return id === "mobile-auth-bridge-link" ? link : null
        }
      }
    })

    expect(replaceSpy).toHaveBeenCalledWith(
      "showready://auth/callback?access_token=access&refresh_token=refresh"
    )
    expect(link.getAttribute("href")).toBe(
      "showready://auth/callback?access_token=access&refresh_token=refresh"
    )
  })
})
