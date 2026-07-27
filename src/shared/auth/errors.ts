export class AuthenticationError extends Error {
  readonly code = "UNAUTHENTICATED";
}

export class AuthorizationError extends Error {
  readonly code: "ACCESS_DENIED" | "INCONSISTENT_MEMBERSHIP";

  constructor(
    message: string,
    code: "ACCESS_DENIED" | "INCONSISTENT_MEMBERSHIP" = "ACCESS_DENIED",
  ) {
    super(message);
    this.code = code;
  }
}
