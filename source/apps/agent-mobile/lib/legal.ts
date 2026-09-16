import { getPublicSiteUrl } from "./env"

export type LegalLinkKey = "privacy" | "terms" | "support" | "accountDeletion"

const legalPaths: Record<LegalLinkKey, string> = {
  privacy: "/privacy",
  terms: "/terms",
  support: "/support",
  accountDeletion: "/account-deletion",
}

export function getLegalUrl(key: LegalLinkKey) {
  return `${getPublicSiteUrl()}${legalPaths[key]}`
}
