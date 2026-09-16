"use client"

import { useEffect } from "react"

type ClientErrorPayload = {
  eventType: "error" | "unhandledrejection"
  name?: string
  message: string
  stack?: string
  path: string
  source?: string
  line?: number
  column?: number
}

const MAX_REPORTS_PER_PAGE = 20

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : undefined
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error.trim()) {
    return error
  }

  return fallback
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined
}

function postClientError(payload: ClientErrorPayload) {
  const body = JSON.stringify(payload)

  if (typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(
      "/api/client-errors",
      new Blob([body], {
        type: "application/json"
      })
    )

    if (sent) {
      return
    }
  }

  void fetch("/api/client-errors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => {})
}

export function ClientErrorReporter() {
  useEffect(() => {
    let reportCount = 0
    const reportedFingerprints = new Set<string>()

    function report(payload: Omit<ClientErrorPayload, "path">) {
      const fingerprint = [
        payload.eventType,
        payload.name,
        payload.message,
        payload.source,
        payload.line,
        payload.column,
        window.location.pathname
      ].join(":")

      if (reportCount >= MAX_REPORTS_PER_PAGE || reportedFingerprints.has(fingerprint)) {
        return
      }

      reportCount += 1
      reportedFingerprints.add(fingerprint)
      postClientError({
        ...payload,
        path: window.location.pathname
      })
    }

    function handleError(event: ErrorEvent) {
      report({
        eventType: "error",
        name: getErrorName(event.error),
        message: event.message || getErrorMessage(event.error, "Unhandled browser error."),
        stack: getErrorStack(event.error),
        source: event.filename || undefined,
        line: event.lineno || undefined,
        column: event.colno || undefined
      })
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      report({
        eventType: "unhandledrejection",
        name: getErrorName(event.reason),
        message: getErrorMessage(event.reason, "Unhandled promise rejection."),
        stack: getErrorStack(event.reason)
      })
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  return null
}
