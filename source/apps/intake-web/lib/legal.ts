export const SUPPORT_EMAIL = "support@showready.app"
export const PRIVACY_EFFECTIVE_DATE = "May 10, 2026"
export const TERMS_EFFECTIVE_DATE = "May 10, 2026"

export const LEGAL_LINKS = {
  privacy: "/privacy",
  terms: "/terms",
  support: "/support",
  accountDeletion: "/account-deletion"
} as const

export const DATA_COLLECTED = [
  "Account profile details, including name, email address, brokerage, and license number.",
  "Lead and client details entered through ShowReady, including names, email addresses, phone numbers, intake answers, lead status, appointments, and showing notes.",
  "Authentication, consent, audit, notification, product event, and diagnostic records needed to operate and secure the service.",
  "Device push notification tokens when notification permission is granted."
]

export const DATA_USE_REASONS = [
  "Authenticate agents and keep each workspace scoped to the correct account.",
  "Capture, score, organize, export, and delete real estate lead and client records.",
  "Send requested app, push, and email notifications.",
  "Troubleshoot reliability problems, prevent abuse, preserve audit history, and support account or data deletion requests."
]
