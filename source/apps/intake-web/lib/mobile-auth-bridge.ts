const AUTH_CALLBACK_KEYS = [
  "access_token",
  "refresh_token",
  "type",
  "code",
  "error",
  "error_code",
  "error_description",
  "expires_at",
  "expires_in",
  "provider_token",
  "provider_refresh_token",
  "token_type"
] as const

export const MOBILE_NATIVE_AUTH_CALLBACK_URL = "showready://auth/callback"
export const MOBILE_AUTH_BRIDGE_LINK_ID = "mobile-auth-bridge-link"

function mergeAuthParams(url: string) {
  const currentUrl = new URL(url)
  const mergedParams = new URLSearchParams(currentUrl.search)
  const hashValue = currentUrl.hash.startsWith("#") ? currentUrl.hash.slice(1) : currentUrl.hash
  const hashParams = new URLSearchParams(hashValue)

  for (const [key, value] of hashParams.entries()) {
    if (!mergedParams.has(key)) {
      mergedParams.append(key, value)
    }
  }

  return mergedParams
}

function hasAuthCallbackParams(params: URLSearchParams) {
  return AUTH_CALLBACK_KEYS.some((key) => params.has(key))
}

export function buildNativeAuthCallbackUrl(
  url: string,
  nativeCallbackUrl = MOBILE_NATIVE_AUTH_CALLBACK_URL
) {
  const mergedParams = mergeAuthParams(url)

  if (!hasAuthCallbackParams(mergedParams)) {
    return null
  }

  const nextUrl = new URL(nativeCallbackUrl)
  nextUrl.search = mergedParams.toString()

  return nextUrl.toString()
}

export function getMobileAuthBridgeBootstrapScript(
  nativeCallbackUrl = MOBILE_NATIVE_AUTH_CALLBACK_URL,
  linkId = MOBILE_AUTH_BRIDGE_LINK_ID
) {
  return `
(() => {
  try {
    const authCallbackKeys = ${JSON.stringify(AUTH_CALLBACK_KEYS)};
    const currentUrl = new URL(window.location.href);
    const mergedParams = new URLSearchParams(currentUrl.search);
    const hashValue = currentUrl.hash.startsWith("#") ? currentUrl.hash.slice(1) : currentUrl.hash;
    const hashParams = new URLSearchParams(hashValue);

    for (const [key, value] of hashParams.entries()) {
      if (!mergedParams.has(key)) {
        mergedParams.append(key, value);
      }
    }

    const hasAuthParams = authCallbackKeys.some((key) => mergedParams.has(key));
    if (!hasAuthParams) {
      return;
    }

    const nextUrl = new URL(${JSON.stringify(nativeCallbackUrl)});
    nextUrl.search = mergedParams.toString();

    const nextHref = nextUrl.toString();
    const link = document.getElementById(${JSON.stringify(linkId)});

    if (link && typeof link.setAttribute === "function") {
      link.setAttribute("href", nextHref);
    }

    window.location.replace(nextHref);
  } catch {
    console.error("ShowReady mobile auth bridge failed.");
  }
})();
`.trim()
}
