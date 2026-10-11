import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { VIEW_AS_COOKIE, VIEW_AS_MAX_AGE_SECONDS, VIEW_AS_ROLES } from "@/features/super-admin/view-as-constants";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { invalidateTenantContextCache } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ userId: z.string().trim().min(1).max(80) });

/** Start "Ver como": a platform admin picks an active broker or supervisor. */
export async function POST(request: Request) {
  const admin = await getRequiredPlatformAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Só o super admin pode usar o Ver como." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === admin.userId) return NextResponse.json({ error: "Escolha outro usuário." }, { status: 400 });

  const [target] = await getDatabase()
    .select({ userId: schema.tenantMemberships.userId, role: schema.tenantMemberships.role, tenantId: schema.tenantMemberships.tenantId, name: schema.user.name })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(
      eq(schema.tenantMemberships.userId, parsed.data.userId),
      eq(schema.tenantMemberships.status, "active"),
      inArray(schema.tenantMemberships.role, [...VIEW_AS_ROLES]),
      eq(schema.user.active, true),
    ))
    .limit(1);
  if (!target) return NextResponse.json({ error: "Esse usuário não é um corretor ou supervisor ativo." }, { status: 404 });

  (await cookies()).set(VIEW_AS_COOKIE, target.userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: VIEW_AS_MAX_AGE_SECONDS,
  });
  invalidateTenantContextCache(target.userId);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: admin.userId,
    action: "view_as.started",
    targetType: "user",
    targetId: target.userId,
    metadata: { role: target.role, tenantId: target.tenantId, name: target.name },
    createdAt: new Date(),
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, name: target.name, role: target.role });
}
