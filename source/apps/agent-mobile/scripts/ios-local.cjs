#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process")

const command = process.argv[2] ?? "doctor"
const rawCommandArgs = process.argv.slice(3)
const commandArgs = rawCommandArgs[0] === "--" ? rawCommandArgs.slice(1) : rawCommandArgs

function isFullXcodeDeveloperDir(developerDir) {
  return typeof developerDir === "string" && developerDir.endsWith(".app/Contents/Developer")
}

function runSync(file, args) {
  const result = spawnSync(file, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })

  if (result.error || result.status !== 0) {
    return null
  }

  return result.stdout.trim()
}

function getDeveloperDir() {
  return runSync("xcode-select", ["-p"])
}

function canRunSimctl() {
  return runSync("xcrun", ["simctl", "list", "devices"]) !== null
}

function buildDoctorSummary({ developerDir, simctlAvailable }) {
  const fullXcode = isFullXcodeDeveloperDir(developerDir)
  const lines = [
    "iOS local setup",
    `Xcode developer dir: ${developerDir ?? "not found"}`,
    `Full Xcode selected: ${fullXcode ? "yes" : "no"}`,
    `simctl available: ${simctlAvailable ? "yes" : "no"}`
  ]

  if (!fullXcode) {
    lines.push("")
    lines.push("Full Xcode is required for iOS simulator builds and device testing.")
    lines.push("Run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer")
  }

  return lines.join("\n")
}

function printDoctor() {
  console.log(
    buildDoctorSummary({
      developerDir: getDeveloperDir(),
      simctlAvailable: canRunSimctl()
    })
  )
}

function requireFullXcode() {
  const developerDir = getDeveloperDir()

  if (isFullXcodeDeveloperDir(developerDir)) {
    return
  }

  console.error(
    buildDoctorSummary({
      developerDir,
      simctlAvailable: canRunSimctl()
    })
  )
  process.exit(1)
}

function runStreaming(file, args) {
  const child = spawn(file, args, { stdio: "inherit" })
  child.on("error", (error) => {
    console.error(`${file}: ${error.message}`)
    process.exit(1)
  })
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

function main() {
  switch (command) {
    case "doctor":
      printDoctor()
      break
    case "run":
      requireFullXcode()
      runStreaming("corepack", ["pnpm", "exec", "expo", "run:ios", ...commandArgs])
      break
    default:
      console.error(`Unknown ios-local command: ${command}`)
      process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  buildDoctorSummary,
  isFullXcodeDeveloperDir
}
