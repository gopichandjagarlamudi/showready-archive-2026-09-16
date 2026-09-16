import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

function walkSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") {
      continue
    }

    if (/\.test\.(ts|tsx)$/.test(entry.name)) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(fullPath))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, "utf8")
}

describe("admin secret and PII safety", () => {
  const adminRoot = path.resolve(import.meta.dirname, "..")
  const sourceFiles = walkSourceFiles(adminRoot)

  it("no file references NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", () => {
    for (const filePath of sourceFiles) {
      const content = readFileContent(filePath)
      expect(
        content,
        `${filePath} references NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`
      ).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
    }
  })

  it("no browser component imports server-only modules", () => {
    for (const filePath of sourceFiles) {
      const content = readFileContent(filePath)

      const isClientComponent = /^["']use client["']/.test(content.trimStart())

      if (!isClientComponent) {
        continue
      }

      const importsAdmin =
        content.includes("@/lib/supabase/admin") ||
        content.includes("./lib/supabase/admin")

      const importsDashboard =
        content.includes("@/lib/dashboard") ||
        content.includes("./lib/dashboard")

      expect(
        importsAdmin,
        `${filePath} is a browser component but imports @/lib/supabase/admin`
      ).toBe(false)

      expect(
        importsDashboard,
        `${filePath} is a browser component but imports @/lib/dashboard`
      ).toBe(false)
    }
  })
})
