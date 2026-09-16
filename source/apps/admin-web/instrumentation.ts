import type { Instrumentation } from "next"
import { captureAdminServerError } from "./lib/observability"

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await captureAdminServerError(error, {
    route: `next.${context.routeType ?? "request"}.${context.routePath ?? "unknown"}`,
    method: request.method,
    path: request.path
  })
}
