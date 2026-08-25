import "server-only";

import { headers } from "next/headers";
import { getAuth } from "./index";
import { AuthenticationError } from "./errors";
import {
  markAuthStart,
  markAuthEnd,
  withTimeout,
  getRequestTiming,
} from "@/shared/observability/request-timing";

const SESSION_TIMEOUT_MS = 15_000;

export async function getRequiredSession() {
  markAuthStart();

  try {
    const session = await withTimeout(
      getAuth().api.getSession({
        headers: await headers(),
        query: { disableCookieCache: true },
      }),
      SESSION_TIMEOUT_MS,
      "getRequiredSession",
    );

    markAuthEnd();

    if (!session) {
      throw new AuthenticationError("An authenticated session is required.");
    }

    return session;
  } catch (error) {
    markAuthEnd();

    const timing = getRequestTiming();
    const requestId = timing?.requestId ?? "unknown";

    // Distinguish timeout from other errors
    const isTimeout =
      error instanceof Error && error.message.startsWith("TIMEOUT:");

    if (isTimeout) {
      console.error(
        JSON.stringify({
          type: "auth_timeout",
          requestId,
          timeoutMs: SESSION_TIMEOUT_MS,
        }),
      );
      throw new AuthenticationError(
        "A autenticação está demorando mais que o esperado. Tente novamente.",
        "AUTH_TIMEOUT",
      );
    }

    // Re-throw AuthenticationError as-is (no double logging)
    if (error instanceof AuthenticationError) {
      throw error;
    }

    // Unexpected error
    console.error(
      JSON.stringify({
        type: "auth_error",
        requestId,
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    throw error;
  }
}
