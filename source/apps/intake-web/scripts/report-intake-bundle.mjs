import { existsSync, readFileSync } from "node:fs"
import { gzipSync } from "node:zlib"
import path from "node:path"

const route = "/intake/[token]/page"
const manifestPath = path.resolve(
  ".next/server/app/intake/[token]/page_client-reference-manifest.js"
)
const rawBudget = 100 * 1024
const gzipBudget = 25 * 1024
const forbiddenPatterns = [
  /DashboardSummarySchema/,
  /DiagnosticsBatchSchema/,
  /AppointmentMutationSchema/,
  /createClient\(/
]

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    fail(`Missing intake client reference manifest: ${manifestPath}`)
    return null
  }

  const source = readFileSync(manifestPath, "utf8")
  const match = source.match(
    /globalThis\.__RSC_MANIFEST\["\/intake\/\[token\]\/page"\]\s*=\s*(\{[\s\S]*\});?\s*$/
  )

  if (!match) {
    fail(`Unable to parse intake client reference manifest: ${manifestPath}`)
    return null
  }

  return JSON.parse(match[1])
}

function toChunkPath(chunk) {
  return path.resolve(".next", chunk.replace(/^\/_next\//, ""))
}

function getChunks(manifest) {
  const clientModules = manifest.clientModules ?? {}
  const intakeFlowChunks = new Set()
  const sharedLayoutChunks = new Set()

  for (const [modulePath, entry] of Object.entries(clientModules)) {
    if (modulePath.includes("components/intake-flow.tsx")) {
      for (const chunk of entry.chunks ?? []) {
        intakeFlowChunks.add(chunk.replace(/^\/_next\//, ""))
      }
    }
  }

  for (const [entryPath, chunks] of Object.entries(manifest.entryJSFiles ?? {})) {
    if (entryPath.includes("app/layout")) {
      for (const chunk of chunks) {
        sharedLayoutChunks.add(chunk)
      }
    }
  }

  return [...intakeFlowChunks].filter((chunk) => !sharedLayoutChunks.has(chunk))
}

function formatBytes(bytes) {
  return `${bytes.toLocaleString()} B`
}

const manifest = readManifest()

if (manifest) {
  const pageChunks = getChunks(manifest)
  let rawTotal = 0
  let gzipTotal = 0
  const forbiddenHits = []

  console.log(`Intake route bundle report for ${route}`)

  for (const chunk of pageChunks) {
    const chunkPath = toChunkPath(chunk)
    const source = readFileSync(chunkPath)
    const gzipSize = gzipSync(source).byteLength

    rawTotal += source.byteLength
    gzipTotal += gzipSize

    console.log(`- ${chunk}: ${formatBytes(source.byteLength)} raw, ${formatBytes(gzipSize)} gzip`)

    const text = source.toString("utf8")
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) {
        forbiddenHits.push(`${chunk}: ${pattern}`)
      }
    }
  }

  console.log(`Total page-specific intake JS: ${formatBytes(rawTotal)} raw, ${formatBytes(gzipTotal)} gzip`)

  if (rawTotal > rawBudget || gzipTotal > gzipBudget) {
    fail(
      `Intake page-specific JS exceeds budget: ${formatBytes(rawTotal)} raw / ${formatBytes(gzipTotal)} gzip`
    )
  }

  if (forbiddenHits.length > 0) {
    fail(`Forbidden intake bundle content found:\n${forbiddenHits.join("\n")}`)
  }
}
