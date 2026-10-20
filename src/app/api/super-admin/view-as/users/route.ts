import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { VIEW_AS_ROLES } from "@/features/super-admin/view-as-constants";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

export type ViewAsCandidate = { userId: string; name: string; email: string; role: "broker" | "supervisor" | "manager"; tenantName: string; branchName: string | null; image: string | null };

/** Brokers and supervisors a platform admin can view as (search by name or e-mail). */
export async function GET(request: Request) {
  const admin = await getRequiredPlatformAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Só o super admin pode usar o Ver como." }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 60) ?? "";
  const term = `%${query.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
  const rows = await getDatabase()
    .select({
      userId: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      image: schema.user.image,
      role: schema.tenantMemberships.role,
      tenantName: schema.tenants.name,
      branchName: schema.branches.name,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.tenantMemberships.tenantId))
    .leftJoin(schema.branches, eq(schema.branches.id, schema.tenantMemberships.branchId))
    .where(and(
      eq(schema.tenantMemberships.status, "active"),
      inArray(schema.tenantMemberships.role, [...VIEW_AS_ROLES]),
      eq(schema.user.active, true),
      query ? or(ilike(schema.user.name, term), ilike(schema.user.email, term)) : undefined,
    ))
    .orderBy(asc(schema.user.name))
    .limit(30);
  const users: ViewAsCandidate[] = rows
    .filter((row) => row.userId !== admin.userId)
    .map((row) => ({ ...row, role: row.role === "supervisor" ? "supervisor" : "broker" }));
  return NextResponse.json({ users });
}
