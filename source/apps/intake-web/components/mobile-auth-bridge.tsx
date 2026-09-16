import type { ReactNode } from "react"
import {
  MOBILE_NATIVE_AUTH_CALLBACK_URL,
  MOBILE_AUTH_BRIDGE_LINK_ID,
  getMobileAuthBridgeBootstrapScript
} from "@/lib/mobile-auth-bridge"

type MobileAuthBridgeProps = {
  children?: ReactNode
}

const pageStyles = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "40px 24px",
  background:
    "radial-gradient(circle at top left, rgba(31,95,87,0.12), transparent 30%), linear-gradient(180deg, var(--sr-bone-raised), var(--sr-bone))"
} as const

const cardStyles = {
  maxWidth: 520,
  background: "var(--sr-bone-raised)",
  border: "1px solid var(--sr-border)",
  borderRadius: 32,
  padding: 32,
  boxShadow: "var(--sr-shadow-soft)",
  display: "grid",
  gap: 16
} as const

const buttonStyles = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "0 18px",
  borderRadius: 999,
  background: "var(--sr-cypress)",
  color: "white",
  fontWeight: 700,
  textDecoration: "none"
} as const

export function MobileAuthBridge({ children }: MobileAuthBridgeProps) {
  if (children) {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: getMobileAuthBridgeBootstrapScript() }} />
        {children}
      </>
    )
  }

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: getMobileAuthBridgeBootstrapScript() }} />
      <main style={pageStyles}>
        <section style={cardStyles}>
          <p
            style={{
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontSize: 12,
              color: "var(--sr-cypress)"
            }}
          >
            Returning to ShowReady
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--sr-font-display)",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              lineHeight: 1.05
            }}
          >
            Opening the app to finish authentication.
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--sr-ink-muted)",
              lineHeight: 1.6,
              fontSize: 16
            }}
          >
            If ShowReady does not open automatically, use the button below to return to the app and
            complete authentication.
          </p>
          <a
            id={MOBILE_AUTH_BRIDGE_LINK_ID}
            href={MOBILE_NATIVE_AUTH_CALLBACK_URL}
            style={buttonStyles}
          >
            Open ShowReady
          </a>
        </section>
      </main>
    </>
  )
}
