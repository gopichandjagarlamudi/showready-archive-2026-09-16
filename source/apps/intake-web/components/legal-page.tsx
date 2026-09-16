import type { ReactNode } from "react"
import Link from "next/link"
import { LEGAL_LINKS, SUPPORT_EMAIL } from "@/lib/legal"

export function LegalPage({
  title,
  eyebrow,
  children
}: {
  title: string
  eyebrow: string
  children: ReactNode
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--sr-bone)",
        padding: "40px 20px"
      }}
    >
      <article
        style={{
          width: "100%",
          maxWidth: 880,
          margin: "0 auto",
          display: "grid",
          gap: 28
        }}
      >
        <nav
          aria-label="Legal"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            color: "var(--sr-ink-muted)",
            fontSize: 14
          }}
        >
          <Link href={LEGAL_LINKS.privacy}>Privacy Policy</Link>
          <Link href={LEGAL_LINKS.terms}>Terms of Use</Link>
          <Link href={LEGAL_LINKS.support}>Support</Link>
          <Link href={LEGAL_LINKS.accountDeletion}>Account Deletion</Link>
        </nav>

        <header
          style={{
            display: "grid",
            gap: 10,
            paddingBottom: 24,
            borderBottom: "1px solid var(--sr-border)"
          }}
        >
          <p
            style={{
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontSize: 12,
              color: "var(--sr-cypress)",
              fontWeight: 700
            }}
          >
            {eyebrow}
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--sr-font-display)",
              fontSize: "clamp(2.25rem, 7vw, 4.5rem)",
              lineHeight: 1
            }}
          >
            {title}
          </h1>
        </header>

        <div
          style={{
            display: "grid",
            gap: 26,
            color: "var(--sr-ink)",
            lineHeight: 1.65
          }}
        >
          {children}
        </div>
      </article>
    </main>
  )
}

export function LegalSection({
  title,
  children
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section
      style={{
        display: "grid",
        gap: 10
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "1.25rem",
          lineHeight: 1.2
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 22
      }}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function SupportMailLink({ children = SUPPORT_EMAIL }: { children?: ReactNode }) {
  return <a href={`mailto:${SUPPORT_EMAIL}`}>{children}</a>
}
