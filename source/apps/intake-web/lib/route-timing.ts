import { NextResponse } from "next/server"

type TimingEntry = {
  name: string
  durationMs: number
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}

function normalizeTimingName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}

export function createRouteTiming() {
  const entries: TimingEntry[] = []

  return {
    async measure<T>(name: string, loader: () => Promise<T>): Promise<T> {
      const startedAt = nowMs()

      try {
        return await loader()
      } finally {
        entries.push({
          name: normalizeTimingName(name),
          durationMs: Math.max(0, nowMs() - startedAt)
        })
      }
    },
    headerValue() {
      return entries
        .map((entry) => `${entry.name};dur=${entry.durationMs.toFixed(1)}`)
        .join(", ")
    }
  }
}

export function jsonWithRouteTiming(
  body: unknown,
  timing: ReturnType<typeof createRouteTiming>,
  init: ResponseInit = {}
) {
  const headers = new Headers(init.headers)
  const serverTiming = timing.headerValue()

  if (serverTiming) {
    headers.set("Server-Timing", serverTiming)
  }

  return NextResponse.json(body, {
    ...init,
    headers
  })
}
