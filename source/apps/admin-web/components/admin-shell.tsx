import Link from "next/link"

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sr-shell">
      <nav className="sr-nav">
        <Link href="/" className="sr-nav-link">Overview</Link>
        <Link href="/users" className="sr-nav-link">Users</Link>
        <Link href="/feedback" className="sr-nav-link">Feedback</Link>
      </nav>
      <main className="sr-main">{children}</main>
    </div>
  )
}
