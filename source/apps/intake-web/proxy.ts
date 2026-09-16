import { NextResponse, type NextRequest } from "next/server"

const BLOCKED_USER_AGENT_PATTERN =
  /\b(?:ahrefsbot|baiduspider|curl|dotbot|mj12bot|python-requests|semrushbot|wget)\b/i

function isPublicIntakePath(pathname: string) {
  return pathname.startsWith("/intake/") || pathname.startsWith("/api/intake/")
}

function isAllowedMethod(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/intake/")) {
    return request.method === "POST" || request.method === "OPTIONS"
  }

  return request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS"
}

function hasReasonablePath(pathname: string) {
  if (pathname.length > 512) {
    return false
  }

  return pathname
    .split("/")
    .filter(Boolean)
    .every((segment) => segment.length <= 256)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isPublicIntakePath(pathname)) {
    return NextResponse.next()
  }

  if (!isAllowedMethod(request)) {
    return new NextResponse("Method not allowed.", { status: 405 })
  }

  if (!hasReasonablePath(pathname)) {
    return new NextResponse("Bad request.", { status: 400 })
  }

  const userAgent = request.headers.get("user-agent") ?? ""
  if (BLOCKED_USER_AGENT_PATTERN.test(userAgent)) {
    return new NextResponse("Forbidden.", { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/intake/:path*", "/api/intake/:path*"]
}
