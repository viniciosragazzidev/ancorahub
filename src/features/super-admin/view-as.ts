import "server-only";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { TtlCache } from "@/shared/cache/ttl-cache";
import { getDatabase, schema } from "@/shared/db";

/**
 * "Ver como" (super admin): the platform admin sees the app exactly as one
 * broker or supervisor sees it. Read only: the proxy blocks every write while
 * the cookie is present (see VIEW_AS_WRITE_ALLOWED_PREFIXES). The cookie only
 * names the target; on every request the server checks again that the real
 * session user is an active platform admin, so the cookie alone grants nothing.
 */
export { VIEW_AS_COOKIE, VIEW_AS_MAX_AGE_SECONDS, VIEW_AS_ROLES, VIEW_AS_WRITE_ALLOWED_PREFIXES } from "./view-as-constants";
import { VIEW_AS_COOKIE } from "./view-as-constants";

const targetSchema = z.string().trim().min(1).max(80);

export async function readViewAsTargetId(): Promise<string | null> {
  try {
    const value = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    const parsed = targetSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const adminCache = new TtlCache<boolean>(20_000, 500);

/** The real session user is an active platform admin (cached 20s per user in this process). */
export function isActivePlatformAdmin(userId: string) {
  return adminCache.getOrLoad(userId, async () => {
    const [row] = await getDatabase()
      .select({ active: schema.user.active, isPlatformAdmin: schema.user.isPlatformAdmin })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1)
      .catch(() => []);
    return Boolean(row?.active && row.isPlatformAdmin);
  });
}

export function invalidateViewAsAdminCache(userId?: string) {
  if (userId) adminCache.delete(userId);
  else adminCache.clear();
}
