export class AuthenticationError extends Error {
  readonly code: "UNAUTHENTICATED" | "AUTH_TIMEOUT";

  constructor(
    message: string,
    code: "UNAUTHENTICATED" | "AUTH_TIMEOUT" = "UNAUTHENTICATED",
  ) {
    super(message);
    this.code = code;
  }
}

import type { AuthorizationDenyReason } from "./types";

export class AuthorizationError extends Error {
  readonly code: "ACCESS_DENIED" | "INCONSISTENT_MEMBERSHIP" | "TENANT_TIMEOUT" | AuthorizationDenyReason;

  constructor(
    message: string,
    code: "ACCESS_DENIED" | "INCONSISTENT_MEMBERSHIP" | "TENANT_TIMEOUT" | AuthorizationDenyReason = "ACCESS_DENIED",
  ) {
    super(message);
    this.code = code;
  }
}

