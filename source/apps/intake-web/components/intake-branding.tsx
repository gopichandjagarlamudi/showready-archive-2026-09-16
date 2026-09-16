import type { CSSProperties, ReactNode } from "react"
import type { PublicIntakeBranding } from "@/lib/public-intake-branding"

type IntakeBrandStyle = CSSProperties & {
  "--intake-brand-color"?: string
  "--intake-accent-color"?: string
}

function getBrandStyle(branding: PublicIntakeBranding): IntakeBrandStyle {
  return {
    "--intake-brand-color": branding.brandColor ?? "var(--sr-cypress)",
    "--intake-accent-color": branding.accentColor ?? "var(--sr-amber-red)"
  }
}

export function IntakeBrandingHeader({ branding }: { branding: PublicIntakeBranding }) {
  if (!branding.realtorName && !branding.brandLine) {
    return null
  }

  return (
    <div className="intake-realtor-brand">
      {branding.realtorName ? (
        <p className="intake-realtor-label">Presented by {branding.realtorName}</p>
      ) : null}
      {branding.brandLine ? (
        <p className="intake-brand-line">{branding.brandLine}</p>
      ) : null}
    </div>
  )
}

export function ShowReadyPoweredBy() {
  return (
    <div className="intake-powered-by">
      <img
        src="/showready-app-icon.svg"
        alt="ShowReady"
        className="intake-powered-icon"
      />
      <span>Powered by ShowReady</span>
    </div>
  )
}

export function IntakeBrandedShell({
  branding,
  children
}: {
  branding: PublicIntakeBranding
  children: ReactNode
}) {
  return (
    <main className="intake-shell" style={getBrandStyle(branding)}>
      <div className="intake-card">
        <IntakeBrandingHeader branding={branding} />
        {children}
      </div>
      <ShowReadyPoweredBy />
    </main>
  )
}

export function IntakeCompletionMessage({ branding }: { branding: PublicIntakeBranding }) {
  const subject = branding.realtorName
    ? `${branding.realtorName} now has`
    : "Your agent now has"
  const message = `${subject} the information they need to review your readiness, score the next best move, and follow up with a tailored plan.`

  return <p className="intake-copy">{message}</p>
}

export function IntakeStatusPage({
  branding,
  eyebrow,
  title,
  children
}: {
  branding: PublicIntakeBranding
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <IntakeBrandedShell branding={branding}>
      <section className="intake-status-content">
        <p className="intake-eyebrow">{eyebrow}</p>
        <h1 className="intake-status-title">{title}</h1>
        <div className="intake-status-body">{children}</div>
      </section>
    </IntakeBrandedShell>
  )
}
