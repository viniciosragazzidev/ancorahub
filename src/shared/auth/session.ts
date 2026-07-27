import "server-only";

import { headers } from "next/headers";
import { getAuth } from "./index";
import { AuthenticationError } from "./errors";

export async function getRequiredSession() {
  const session = await getAuth().api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });

  if (!session) {
    throw new AuthenticationError("An authenticated session is required.");
  }

  return session;
}
