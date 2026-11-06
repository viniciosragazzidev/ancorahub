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


/**
 * Platform admin without two-factor authentication. The admin sees every
 * tenant and can purge data, so a password alone is not enough: the layouts
 * send them to set up 2FA first.
 */
export class SecondFactorRequiredError extends AuthorizationError {
  constructor() {
    super("Platform administrators must enable two-factor authentication.", "ACCESS_DENIED");
  }
}
