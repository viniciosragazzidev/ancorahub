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

export class AuthorizationError extends Error {
  readonly code: "ACCESS_DENIED" | "INCONSISTENT_MEMBERSHIP" | "TENANT_TIMEOUT";

  constructor(
    message: string,
    code: "ACCESS_DENIED" | "INCONSISTENT_MEMBERSHIP" | "TENANT_TIMEOUT" = "ACCESS_DENIED",
  ) {
    super(message);
    this.code = code;
  }
}
