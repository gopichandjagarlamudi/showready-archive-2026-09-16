import type { Metadata } from "next"
import { buildWebCssVariables } from "@showready/design-system"
import "./globals.css"

export const metadata: Metadata = {
  title: "ShowReady Admin"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{buildWebCssVariables()}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
