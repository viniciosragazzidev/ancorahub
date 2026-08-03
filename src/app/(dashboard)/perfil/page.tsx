import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isUserProfileEnabled } from "@/features/user-profile/feature";
import { PerfilTabs } from "./perfil-tabs";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  if (!(await isUserProfileEnabled())) redirect("/settings");

  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [user, membership, brokerProfile, auditLogs, sessions, branches] = await Promise.all([
    db
      .select({
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
        emailVerified: schema.user.emailVerified,
        twoFactorEnabled: schema.user.twoFactorEnabled,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(eq(schema.user.id, context.userId))
      .limit(1),
    db
      .select({
        role: schema.tenantMemberships.role,
        jobTitle: schema.tenantMemberships.jobTitle,
        branchId: schema.tenantMemberships.branchId,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
        status: schema.tenantMemberships.status,
        createdAt: schema.tenantMemberships.createdAt,
        branchName: schema.branches.name,
        customRoleName: schema.customRoles.name,
      })
      .from(schema.tenantMemberships)
      .leftJoin(schema.branches, and(eq(schema.tenantMemberships.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
      .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
      .where(eq(schema.tenantMemberships.userId, context.userId))
      .limit(1),
    db
      .select({
        professionalName: schema.brokerProfiles.professionalName,
        phone: schema.brokerProfiles.phone,
        cpf: schema.brokerProfiles.cpf,
        internalCode: schema.brokerProfiles.internalCode,
      })
      .from(schema.brokerProfiles)
      .where(and(eq(schema.brokerProfiles.userId, context.userId), eq(schema.brokerProfiles.tenantId, context.tenantId)))
      .limit(1),
    db
      .select({
        id: schema.auditLogs.id,
        acao: schema.auditLogs.acao,
        entidade: schema.auditLogs.entidade,
        entidadeId: schema.auditLogs.entidadeId,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.userId, context.userId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(50),
    db
      .select({
        id: schema.session.id,
        token: schema.session.token,
        ipAddress: schema.session.ipAddress,
        userAgent: schema.session.userAgent,
        createdAt: schema.session.createdAt,
        expiresAt: schema.session.expiresAt,
      })
      .from(schema.session)
      .where(eq(schema.session.userId, context.userId))
      .orderBy(desc(schema.session.createdAt))
      .limit(20),
    db
      .select({ id: schema.branches.id, name: schema.branches.name })
      .from(schema.branches)
      .where(eq(schema.branches.tenantId, context.tenantId))
      .orderBy(schema.branches.name),
  ]);

  const data = {
    user: user[0],
    membership: membership[0],
    brokerProfile: brokerProfile[0] ?? null,
    auditLogs: auditLogs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
    sessions: sessions.map((session) => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    })),
    branches,
    currentUserId: context.userId,
  };

  return (
    <>
      <DashboardHeader breadcrumb="Minha área" title="Meu perfil" />
      <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 bg-background p-4 lg:p-6">
        <PerfilTabs data={data} />
      </main>
    </>
  );
}
