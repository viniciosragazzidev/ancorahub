import { NextResponse } from "next/server";
import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { ExtensionRateLimitError } from "./rate-limit";

export function extensionErrorResponse(error: unknown) {
  if (error instanceof ExtensionRateLimitError) return NextResponse.json({ error: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(error.retryAfter), "Cache-Control": "no-store" } });
  const status = error instanceof AuthenticationError ? 401 : error instanceof AuthorizationError ? 403 : 400;
  return NextResponse.json({ error: status === 401 ? "SESSION_EXPIRED" : status === 403 ? "FORBIDDEN" : "INVALID_REQUEST" },
    { status, headers: { "Cache-Control": "no-store" } });
}
