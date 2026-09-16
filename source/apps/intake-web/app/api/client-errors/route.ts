import { NextResponse } from "next/server"
import { z } from "zod"
import { captureClientError } from "@/lib/observability"
import { consumeRateLimit, getClientIp, getDefaultRateLimitStore } from "@/lib/rate-limit"

const ClientErrorPayloadSchema = z.strictObject({
  eventType: z.enum(["error", "unhandledrejection", "react"]).optional(),
  name: z.string().min(1).max(120).optional(),
  message: z.string().min(1).max(2000).default("Unknown client error."),
  stack: z.string().max(8000).optional(),
  path: z.string().min(1).max(500).optional(),
  source: z.string().min(1).max(500).optional(),
  line: z.number().int().nonnegative().optional(),
  column: z.number().int().nonnegative().optional()
})

function createClientError(payload: z.infer<typeof ClientErrorPayloadSchema>) {
  const error = new Error(payload.message)
  error.name = payload.name ?? "ClientError"

  if (payload.stack) {
    error.stack = payload.stack
  }

  return error
}

async function isAllowedClientErrorReport(request: Request) {
  try {
    const result = await consumeRateLimit(getDefaultRateLimitStore(), {
      key: `client-errors:${getClientIp(request)}`,
      limit: 30,
      windowMs: 60000
    })

    return result.allowed
  } catch {
    return true
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAllowedClientErrorReport(request))) {
      return new NextResponse(null, { status: 204 })
    }

    const payload = ClientErrorPayloadSchema.parse(await request.json())

    await captureClientError({
      request,
      error: createClientError(payload),
      route: "client.web",
      path: payload.path ?? new URL(request.url).pathname,
      context: {
        eventType: payload.eventType ?? "error",
        source: payload.source,
        line: payload.line,
        column: payload.column
      }
    })
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  return new NextResponse(null, { status: 204 })
}
