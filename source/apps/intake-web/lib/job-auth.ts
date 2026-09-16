export function isAuthorizedJobRequest(request: Request) {
  const secret = process.env.JOB_PROCESSOR_TOKEN ?? process.env.CRON_SECRET

  if (!secret) {
    return false
  }

  const authorization = request.headers.get("authorization")?.trim()
  const jobToken = request.headers.get("x-job-token")?.trim()

  return authorization === `Bearer ${secret}` || jobToken === secret
}
