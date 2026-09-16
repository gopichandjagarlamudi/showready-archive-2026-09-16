import type { Instrumentation } from "next"
import { captureNextRequestError } from "./lib/observability-edge"

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await captureNextRequestError(error, {
    path: request.path,
    method: request.method,
    headers: request.headers,
    context
  })
}
