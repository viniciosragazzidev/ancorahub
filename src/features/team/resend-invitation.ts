import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCanManageMember } from "@/shared/auth/team-permissions";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { createBrokerInvitation, generateNextInternalCode } from "./onboarding-helpers";
import { enqueueBrokerInvitation } from "./broker-invitation-delivery";

/** Accepts a team row, profile, user or invitation ID; authority always comes from the database. */
export async function resendTeamInvitation(rawId: unknown) {
  const memberId = z.string().uuid().parse(rawId);
  const context = await getRequiredTenantContext();
  if ((await getSystemSetting("feature_team_invitation_resend_enabled")) === "false") {
    throw new Error("O reenvio de convites está desativado pelo Super-admin.");
  }
  const db = getDatabase();
  const renewed = await db.transaction(async (tx) => {
    // Serialize renewals, including legacy members that do not have a profile yet.
    await tx.select({ id: schema.tenants.id }).from(schema.tenants)
      .where(eq(schema.tenants.id, context.tenantId)).limit(1).for("update");
    const [requestedInvitation] = await tx.select().from(schema.brokerInvitations)
      .where(and(eq(schema.brokerInvitations.id, memberId), eq(schema.brokerInvitations.tenantId, context.tenantId))).limit(1);

    const findMembership = async (identifier: string) => {
      const [membership] = await tx.select({
        id: schema.tenantMemberships.id, userId: schema.tenantMemberships.userId,
        role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle,
        customRoleId: schema.tenantMemberships.customRoleId, branchId: schema.tenantMemberships.branchId,
        status: schema.tenantMemberships.status, userStatus: schema.user.status,
        name: schema.user.name, email: schema.user.email,
      }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), or(
          eq(schema.tenantMemberships.id, identifier), eq(schema.tenantMemberships.userId, identifier),
        ))).limit(1);
      return membership;
    };
    let membership = await findMembership(memberId);
    let [profile] = await tx.select().from(schema.brokerProfiles).where(and(
      eq(schema.brokerProfiles.tenantId, context.tenantId),
      or(eq(schema.brokerProfiles.id, requestedInvitation?.brokerProfileId ?? memberId),
        eq(schema.brokerProfiles.userId, membership?.userId ?? memberId)),
    )).limit(1).for("update");
    if (profile?.userId && !membership) membership = await findMembership(profile.userId);
    if (!profile && !membership) throw new Error("Membro não encontrado nesta empresa.");

    const [previous] = profile ? await tx.select().from(schema.brokerInvitations)
      .where(and(eq(schema.brokerInvitations.tenantId, context.tenantId), eq(schema.brokerInvitations.brokerProfileId, profile.id)))
      .orderBy(desc(schema.brokerInvitations.createdAt), desc(schema.brokerInvitations.id)).limit(1) : [];
    const role = membership?.role ?? previous?.role ?? "broker";
    const jobTitle = membership?.jobTitle ?? previous?.jobTitle ?? role;
    const customRoleId = membership ? membership.customRoleId : previous?.customRoleId ?? null;
    const branchId = membership ? membership.branchId : profile?.branchId;
    requireCanManageMember(context, { role, branchId: branchId ?? null, userId: membership?.userId ?? profile?.userId ?? memberId });
    if (membership?.status === "inactive" || membership?.userStatus === "disabled" || (profile && ["INACTIVE", "SUSPENDED", "ARCHIVED"].includes(profile.lifecycleStatus))) {
      throw new Error("O membro está desativado. Reative o acesso antes de enviar um convite.");
    }
    if (membership?.userStatus === "active" || profile?.activatedAt || profile?.lifecycleStatus === "ACTIVE") {
      throw new Error("Esta conta já foi ativada. Utilize a recuperação de senha.");
    }
    if (!branchId) throw new Error("Vincule uma unidade ao membro antes de reenviar o convite.");
    const [branch] = await tx.select({ id: schema.branches.id }).from(schema.branches)
      .where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"))).limit(1);
    if (!branch) throw new Error("A unidade do membro está indisponível.");

    const now = new Date();
    if (!profile && membership) {
      const values = {
        id: randomUUID(), tenantId: context.tenantId, branchId, userId: membership.userId,
        professionalName: membership.name, invitedEmail: membership.email, phone: "",
        internalCode: await generateNextInternalCode(tx, context.tenantId),
        lifecycleStatus: "INVITED" as const, managerId: context.userId, invitedAt: now,
      };
      [profile] = await tx.insert(schema.brokerProfiles).values(values).returning();
    }
    if (!profile) throw new Error("Não foi possível preparar o perfil para ativação.");
    const invitation = await createBrokerInvitation(tx, context.tenantId, branchId, profile.id,
      membership?.email ?? profile.invitedEmail ?? previous?.email ?? null, role, jobTitle, customRoleId);
    // Superseded links must not be delivered by a later recovery run.
    const oldInvitations = tx.select({ id: schema.brokerInvitations.id }).from(schema.brokerInvitations)
      .where(and(eq(schema.brokerInvitations.tenantId, context.tenantId), eq(schema.brokerInvitations.brokerProfileId, profile.id),
        inArray(schema.brokerInvitations.status, ["REPLACED", "EXPIRED", "REVOKED"])));
    await tx.update(schema.whatsappOutboundMessages).set({ status: "cancelled", updatedAt: now,
      providerErrorCode: "INVITATION_REPLACED", providerErrorMessage: "Convite substituído por um novo reenvio manual." })
      .where(and(eq(schema.whatsappOutboundMessages.tenantId, context.tenantId), eq(schema.whatsappOutboundMessages.purpose, "brokerInvitation"),
        inArray(schema.whatsappOutboundMessages.recipientId, oldInvitations), inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"])));
    await tx.update(schema.brokerProfiles).set({ lifecycleStatus: "INVITED", invitedAt: now, updatedAt: now })
      .where(and(eq(schema.brokerProfiles.id, profile.id), eq(schema.brokerProfiles.tenantId, context.tenantId)));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId,
      entidade: "broker_invitation", entidadeId: invitation.id, acao: "reenviou_convite", createdAt: now });
    return { ...invitation, branchId, phone: profile.phone, name: profile.professionalName, role, jobTitle };
  });

  let whatsappStatus: "queued" | "not_available" | "failed" = "not_available";
  try {
    if (renewed.phone) {
      whatsappStatus = await enqueueBrokerInvitation({ tenantId: context.tenantId, branchId: renewed.branchId,
        invitationId: renewed.id, destinationPhone: renewed.phone, name: renewed.name,
        role: renewed.role, jobTitle: renewed.jobTitle, requestedBy: context.userId });
    } else {
      await db.update(schema.brokerInvitations).set({ deliveryStatus: "not_available", deliveryError: "Membro sem telefone cadastrado; compartilhe o link de ativação." })
        .where(and(eq(schema.brokerInvitations.id, renewed.id), eq(schema.brokerInvitations.tenantId, context.tenantId)));
    }
  } catch {
    // The invitation is already committed: retain the manual link on an enqueue outage.
    whatsappStatus = "failed";
  }
  return { token: renewed.token, invitationId: renewed.id, whatsappStatus };
}
