#!/usr/bin/env node

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawn, spawnSync } = require("node:child_process")

const command = process.argv[2] ?? "doctor"
const rawCommandArgs = process.argv.slice(3)
const commandArgs = rawCommandArgs[0] === "--" ? rawCommandArgs.slice(1) : rawCommandArgs
const home = os.homedir()

function findFirst(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) ?? null
}

function resolveAndroidSdkRoot() {
  return findFirst([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(home, "Library", "Android", "sdk")
  ])
}

function resolveJavaHome() {
  return findFirst([
    process.env.JAVA_HOME,
    "/opt/homebrew/opt/openjdk@17",
    "/usr/local/opt/openjdk@17",
    "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home",
    "/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home"
  ])
}

const sdkRoot = resolveAndroidSdkRoot()
const javaHome = resolveJavaHome()

function buildEnv() {
  const additions = []

  if (javaHome) {
    additions.push(path.join(javaHome, "bin"))
  }

  if (sdkRoot) {
    additions.push(
      path.join(sdkRoot, "emulator"),
      path.join(sdkRoot, "platform-tools"),
      path.join(sdkRoot, "cmdline-tools", "latest", "bin")
    )
  }

  return {
    ...process.env,
    ...(sdkRoot ? { ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot } : {}),
    ...(javaHome ? { JAVA_HOME: javaHome } : {}),
    PATH: [...additions, process.env.PATH].filter(Boolean).join(path.delimiter)
  }
}

const env = buildEnv()

function bin(name) {
  const executable = process.platform === "win32" ? `${name}.exe` : name
  return findFirst([
    sdkRoot ? path.join(sdkRoot, name === "emulator" ? "emulator" : "platform-tools", executable) : null,
    name
  ])
}

function runSync(label, file, args) {
  const result = spawnSync(file, args, {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })

  if (result.error) {
    console.log(`${label}: unavailable (${result.error.message})`)
    return null
  }

  if (result.status !== 0) {
    const error = result.stderr.trim() || result.stdout.trim()
    console.log(`${label}: failed${error ? ` (${error})` : ""}`)
    return null
  }

  return result.stdout.trim()
}

function runStreaming(file, args) {
  const child = spawn(file, args, { env, stdio: "inherit" })
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

function listAvds() {
  const emulator = bin("emulator")
  if (!emulator) {
    return []
  }

  const output = runSync("AVDs", emulator, ["-list-avds"])
  return output ? output.split(/\r?\n/).filter(Boolean) : []
}

function requireSdk() {
  if (!sdkRoot) {
    console.error("Android SDK not found. Install Android Studio or set ANDROID_HOME.")
    process.exit(1)
  }
}

function printDoctor() {
  console.log("Android local setup")
  console.log(`SDK: ${sdkRoot ?? "not found"}`)
  console.log(`JAVA_HOME: ${javaHome ?? "not found"}`)
  console.log(`ANDROID_HOME: ${env.ANDROID_HOME ?? "not set"}`)
  console.log(`ANDROID_SDK_ROOT: ${env.ANDROID_SDK_ROOT ?? "not set"}`)
  console.log("")

  const avds = listAvds()
  console.log("AVDs:")
  if (avds.length === 0) {
    console.log("  none found")
  } else {
    for (const avd of avds) {
      console.log(`  ${avd}`)
    }
  }
  console.log("")

  const adb = bin("adb")
  const devices = adb ? runSync("Connected devices", adb, ["devices", "-l"]) : null
  console.log("Connected devices:")
  console.log(devices ? devices.split(/\r?\n/).map((line) => `  ${line}`).join("\n") : "  adb unavailable")
}

switch (command) {
  case "avds": {
    requireSdk()
    const avds = listAvds()
    console.log(avds.join("\n"))
    break
  }
  case "devices": {
    requireSdk()
    const adb = bin("adb")
    if (!adb) {
      console.error("adb not found.")
      process.exit(1)
    }
    runStreaming(adb, ["devices", "-l"])
    break
  }
  case "doctor": {
    printDoctor()
    break
  }
  case "emulator": {
    requireSdk()
    const emulator = bin("emulator")
    if (!emulator) {
      console.error("Android emulator binary not found.")
      process.exit(1)
    }

    const avds = listAvds()
    const avdName = commandArgs[0] ?? avds[0]

    if (!avdName) {
      console.error("No Android virtual devices found.")
      process.exit(1)
    }

    runStreaming(emulator, ["-avd", avdName])
    break
  }
  case "run": {
    requireSdk()
    runStreaming("corepack", ["pnpm", "exec", "expo", "run:android", ...commandArgs])
    break
  }
  default:
    console.error(`Unknown android-local command: ${command}`)
    process.exit(1)
}
