import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { VIEW_AS_COOKIE } from "@/features/super-admin/view-as-constants";
import { getRequiredSession } from "@/shared/auth/session";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

/** End "Ver como" and go back to the admin's own access. Always clears the cookie. */
export async function GET(request: Request) {
  const store = await cookies();
  const target = store.get(VIEW_AS_COOKIE)?.value ?? null;
  store.delete(VIEW_AS_COOKIE);
  const session = await getRequiredSession().catch(() => null);
  if (session && target) {
    await getDatabase().insert(schema.platformAuditLogs).values({
      id: randomUUID(),
      actorUserId: session.user.id,
      action: "view_as.ended",
      targetType: "user",
      targetId: target,
      metadata: {},
      createdAt: new Date(),
    }).catch(() => undefined);
  }
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
