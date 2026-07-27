import "server-only";

import { eq } from "drizzle-orm";

import { AuthorizationError } from "./errors";
import { getRequiredSession } from "./session";
import type { PlatformAdminContext } from "./types";
import { getDatabase, schema } from "@/shared/db";

export async function getRequiredPlatformAdmin(): Promise<PlatformAdminContext> {
  const { user: sessionUser } = await getRequiredSession();
  const [user] = await getDatabase()
    .select({ id: schema.user.id, email: schema.user.email, active: schema.user.active, isPlatformAdmin: schema.user.isPlatformAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, sessionUser.id))
    .limit(1);

  if (!user?.active || !user.isPlatformAdmin) {
    throw new AuthorizationError("The current user is not a platform administrator.");
  }

  return { userId: user.id, email: user.email };
}
