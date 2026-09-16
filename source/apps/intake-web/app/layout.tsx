import type { ReactNode } from "react"
import type { Metadata } from "next"
import { buildWebCssVariables } from "@showready/design-system"
import { ClientErrorReporter } from "@/components/client-error-reporter"
import "./globals.css"

export const metadata: Metadata = {
  icons: {
    icon: "/showready-app-icon.svg"
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <style>{buildWebCssVariables()}</style>
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  )
}
