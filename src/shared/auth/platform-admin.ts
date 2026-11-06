import "server-only";

import { eq } from "drizzle-orm";

import { AuthorizationError, SecondFactorRequiredError } from "./errors";
import { getRequiredSession } from "./session";
import type { PlatformAdminContext } from "./types";
import { getDatabase, schema } from "@/shared/db";

/** Where an admin without 2FA is sent to turn it on. */
export const PLATFORM_ADMIN_2FA_SETUP_PATH = "/settings?tab=seguranca";

/**
 * Break-glass only: PLATFORM_ADMIN_2FA_OPTIONAL=true lets an admin in without
 * 2FA (e.g. a new admin with no tenant to open Settings). Remove it right after.
 */
export function isPlatformAdmin2faRequired(env: NodeJS.ProcessEnv = process.env) {
  return env.PLATFORM_ADMIN_2FA_OPTIONAL?.trim() !== "true";
}

export async function getRequiredPlatformAdmin(): Promise<PlatformAdminContext> {
  const { user: sessionUser } = await getRequiredSession();
  const [user] = await getDatabase()
    .select({
      id: schema.user.id,
      email: schema.user.email,
      active: schema.user.active,
      isPlatformAdmin: schema.user.isPlatformAdmin,
      twoFactorEnabled: schema.user.twoFactorEnabled,
    })
    .from(schema.user)
    .where(eq(schema.user.id, sessionUser.id))
    .limit(1);

  if (!user?.active || !user.isPlatformAdmin) {
    throw new AuthorizationError("The current user is not a platform administrator.");
  }
  if (!user.twoFactorEnabled && isPlatformAdmin2faRequired()) {
    throw new SecondFactorRequiredError();
  }

  return { userId: user.id, email: user.email };
}
