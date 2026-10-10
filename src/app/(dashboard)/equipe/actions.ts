"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { resendTeamInvitation } from "@/features/team/resend-invitation";
import { createTeamUser } from "@/features/team/create-user";
import { generatePasswordResetLinkForMember } from "@/features/team/password-recovery";
import { requiresMemberBranch } from "@/features/custom-roles/member-scope";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import {
  requireCanManageMember,
  canManageMember,
  requireCanUpdateMemberAuthority,
} from "@/shared/auth/team-permissions";
import { getDatabase, schema } from "@/shared/db";
import { generateNextInternalCode, createBrokerInvitation } from "@/features/team/onboarding-helpers";
import { processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { scheduleAfterResponse } from "@/shared/async/after-response";
import { enqueueBrokerInvitation } from "@/features/team/broker-invitation-delivery";
import { parseCsv } from "@/shared/utils/csv";
import { ensureDefaultQueue } from "@/features/lead-distribution/service";
import { findPostSaleExemptionQueueName, postSaleTransferAuditAction } from "@/features/lead-distribution/post-sale-transfer";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";
import { getSystemSetting } from "@/features/system-settings/queries";

import { invalidateTenantContextCache } from "@/shared/auth/tenant-context";
import { clearSupervisedBrokers, detachFromSupervision, supervisedBrokersField, syncSupervisedBrokers } from "@/features/team/supervised-brokers";
export type TeamActionState = { success?: boolean; error?: string; message?: string; token?: string; invitationId?: string; whatsappStatus?: "queued" | "not_available" | "failed" | "sent"; status?: "active" | "disabled" };

const memberRole = z.enum(["director", "manager", "supervisor", "broker"]);
const memberJobTitle = z.enum(schema.teamJobTitleValues);

const updateMemberInput = z.object({
  memberId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(254).refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    "Informe um e-mail válido.",
  ).transform((value) => value.toLowerCase()),
  role: memberRole,
  jobTitle: memberJobTitle,
  branchId: z.preprocess(
    (value) => value === "__tenant__" ? "" : value,
    z.string().uuid().optional().or(z.literal("")),
  ),
  customRoleId: z.preprocess(
    (value) => typeof value === "string" && (value.trim() === "" || value === "__none__") ? null : value,
    z.string().uuid().nullable().optional(),
  ),
});

const memberIdInput = z.object({
  memberId: z.string().uuid(),
});

export async function createTeamUserAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const res = await createTeamUser(Object.fromEntries(formData));
    invalidateTenantContextCache(); // role/unit/status changes apply at once
    return { success: true, token: res.token, invitationId: res.invitationId, whatsappStatus: res.whatsappStatus };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro desconhecido ao criar acesso.";
    return { success: false, error: message };
  }
}

export async function updateTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const input = updateMemberInput.parse(Object.fromEntries(formData));
    const supervisedBrokerIds = supervisedBrokersField.parse(formData.get("supervisedBrokerIds") ?? undefined);
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [member] = await db
      .select({
        membershipId: schema.tenantMemberships.id,
        userId: schema.user.id,
        role: schema.tenantMemberships.role,
        jobTitle: schema.tenantMemberships.jobTitle,
        customRoleId: schema.tenantMemberships.customRoleId,
        customRoleScope: schema.customRoles.scope,
        branchId: schema.tenantMemberships.branchId,
        status: schema.user.status,
        profileId: schema.brokerProfiles.id,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .leftJoin(schema.brokerProfiles, and(
        eq(schema.brokerProfiles.userId, schema.user.id),
        eq(schema.brokerProfiles.tenantId, context.tenantId),
      ))
      .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
      .where(
        and(
          eq(schema.tenantMemberships.id, input.memberId),
          eq(schema.tenantMemberships.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!member) {
      const [pendingProfile] = await db
        .select({
          profileId: schema.brokerProfiles.id,
          userId: schema.brokerProfiles.userId,
          role: schema.brokerInvitations.role,
          jobTitle: schema.brokerInvitations.jobTitle,
          customRoleId: schema.brokerInvitations.customRoleId,
          customRoleScope: schema.customRoles.scope,
          branchId: schema.brokerProfiles.branchId,
        })
        .from(schema.brokerProfiles)
        .leftJoin(schema.brokerInvitations, and(
          eq(schema.brokerInvitations.brokerProfileId, schema.brokerProfiles.id),
          eq(schema.brokerInvitations.tenantId, context.tenantId),
          eq(schema.brokerInvitations.status, "PENDING"),
        ))
        .leftJoin(schema.customRoles, eq(schema.brokerInvitations.customRoleId, schema.customRoles.id))
        .where(and(
          eq(schema.brokerProfiles.id, input.memberId),
          eq(schema.brokerProfiles.tenantId, context.tenantId),
        ))
        .limit(1);

      if (!pendingProfile || !pendingProfile.role || !pendingProfile.jobTitle) {
        throw new Error("Membro nao encontrado.");
      }

      const normalizedBranchId = input.branchId || null;
      if (!normalizedBranchId) {
        throw new Error("Convites pendentes precisam de uma unidade vinculada.");
      }

      let customRoleScope: "none" | "own" | "branch" | "tenant" | null = null;
      if (input.customRoleId) {
        if (input.role === "director") throw new Error("Cargos personalizados não podem ser vinculados a um acesso de Diretor.");
        const [customRole] = await db.select({ id: schema.customRoles.id, scope: schema.customRoles.scope })
          .from(schema.customRoles)
          .where(and(
            eq(schema.customRoles.id, input.customRoleId),
            eq(schema.customRoles.tenantId, context.tenantId),
            eq(schema.customRoles.status, "active"),
          ))
          .limit(1);
        if (!customRole) throw new Error("Escolha um cargo personalizado ativo da própria empresa.");
        customRoleScope = customRole.scope;
      }

      requireCanUpdateMemberAuthority({
        actorContext: context,
        targetMember: {
          role: pendingProfile.role,
          branchId: pendingProfile.branchId,
          userId: pendingProfile.userId ?? pendingProfile.profileId,
        },
        proposed: { role: input.role, branchId: normalizedBranchId, customRoleScope },
      });

      const branch = await db
        .select({ id: schema.branches.id })
        .from(schema.branches)
        .where(and(
          eq(schema.branches.id, normalizedBranchId),
          eq(schema.branches.tenantId, context.tenantId),
          eq(schema.branches.status, "active"),
        ))
        .limit(1);
      if (!branch[0]) throw new Error("A filial selecionada nao pertence ao tenant ativo ou esta inativa.");

      if (input.email) {
        const [emailOwner] = await db
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(and(
            eq(schema.user.email, input.email),
            pendingProfile.userId ? ne(schema.user.id, pendingProfile.userId) : undefined,
          ))
          .limit(1);
        if (emailOwner) throw new Error("Ja existe uma identidade com este e-mail.");

        const [profileEmailOwner] = await db
          .select({ id: schema.brokerProfiles.id })
          .from(schema.brokerProfiles)
          .where(and(
            eq(schema.brokerProfiles.tenantId, context.tenantId),
            eq(schema.brokerProfiles.invitedEmail, input.email),
            ne(schema.brokerProfiles.id, pendingProfile.profileId),
          ))
          .limit(1);
        if (profileEmailOwner) throw new Error("Ja existe um convite com este e-mail nesta corretora.");
      }

      const authorityChanged =
        pendingProfile.role !== input.role ||
        pendingProfile.jobTitle !== input.jobTitle ||
        pendingProfile.branchId !== normalizedBranchId ||
        pendingProfile.customRoleId !== (input.customRoleId ?? null);

      await db.transaction(async (tx) => {
        await tx.update(schema.brokerProfiles).set({
          professionalName: input.name,
          invitedEmail: input.email || null,
          branchId: normalizedBranchId,
          updatedAt: new Date(),
        }).where(and(
          eq(schema.brokerProfiles.id, pendingProfile.profileId),
          eq(schema.brokerProfiles.tenantId, context.tenantId),
        ));

        if (pendingProfile.userId) {
          await tx.update(schema.user).set({
            name: input.name,
            ...(input.email ? { email: input.email } : {}),
            updatedAt: new Date(),
          }).where(eq(schema.user.id, pendingProfile.userId));
        }

        await tx.update(schema.brokerInvitations).set({
          email: input.email || null,
          role: input.role,
          jobTitle: input.jobTitle,
          branchId: normalizedBranchId,
          customRoleId: input.customRoleId ?? null,
        }).where(and(
          eq(schema.brokerInvitations.brokerProfileId, pendingProfile.profileId),
          eq(schema.brokerInvitations.tenantId, context.tenantId),
          eq(schema.brokerInvitations.status, "PENDING"),
        ));

        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "broker_profile",
          entidadeId: pendingProfile.profileId,
          acao: "atualizou_membro",
        });

        if (authorityChanged && pendingProfile.userId) {
          await tx.delete(schema.session).where(eq(schema.session.userId, pendingProfile.userId));
          await tx.insert(schema.auditLogs).values({
            id: randomUUID(),
            userId: context.userId,
            entidade: "broker_profile",
            entidadeId: pendingProfile.profileId,
            acao: "revogou_sessoes_por_alteracao_de_autoridade",
          });
        }
      });

      invalidateTenantContextCache(); // role/unit/status changes apply at once
      return { success: true };
    }

    const normalizedBranchId = input.branchId || null;
    if (!input.email) {
      throw new Error("Membros com acesso ativo precisam de um e-mail.");
    }
    let customRoleScope: "none" | "own" | "branch" | "tenant" | null = null;
    if (input.customRoleId) {
      if (input.role === "director") throw new Error("Cargos personalizados não podem ser vinculados a um acesso de Diretor.");
      const [customRole] = await db.select({ id: schema.customRoles.id, scope: schema.customRoles.scope })
        .from(schema.customRoles)
        .where(and(eq(schema.customRoles.id, input.customRoleId), eq(schema.customRoles.tenantId, context.tenantId), eq(schema.customRoles.status, "active")))
        .limit(1);
      if (!customRole) throw new Error("Escolha um cargo personalizado ativo da própria empresa.");
      customRoleScope = customRole.scope;
    }
    requireCanUpdateMemberAuthority({
      actorContext: context,
      targetMember: {
        role: member.role,
        branchId: member.branchId,
        userId: member.userId,
      },
      proposed: {
        role: input.role,
        branchId: normalizedBranchId,
        customRoleScope,
      },
    });

    const requiresBranch = requiresMemberBranch({
      jobTitle: input.jobTitle,
      customRoleScope,
    });
    if (requiresBranch && !normalizedBranchId) {
      throw new Error("Gestor e Corretor, ou cargos limitados a uma unidade, precisam de uma unidade vinculada.");
    }

    const branchRows = normalizedBranchId
      ? await db
        .select({ id: schema.branches.id })
        .from(schema.branches)
        .where(
          and(
            eq(schema.branches.id, normalizedBranchId),
            eq(schema.branches.tenantId, context.tenantId),
            eq(schema.branches.status, "active"),
          ),
        )
        .limit(1)
      : [];
    const [branch] = branchRows;

    if (normalizedBranchId && !branch) {
      throw new Error("A filial selecionada nao pertence ao tenant ativo ou esta inativa.");
    }

    const [emailOwner] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(and(eq(schema.user.email, input.email), ne(schema.user.id, member.userId)))
      .limit(1);

    if (emailOwner) {
      throw new Error("Ja existe uma identidade com este e-mail.");
    }

    if (member.profileId) {
      const [profileEmailOwner] = await db
        .select({ id: schema.brokerProfiles.id })
        .from(schema.brokerProfiles)
        .where(and(
          eq(schema.brokerProfiles.tenantId, context.tenantId),
          eq(schema.brokerProfiles.invitedEmail, input.email),
          ne(schema.brokerProfiles.id, member.profileId),
        ))
        .limit(1);
      if (profileEmailOwner) {
        throw new Error("Ja existe um convite com este e-mail nesta corretora.");
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(schema.user).set({
        name: input.name,
        email: input.email,
        updatedAt: new Date(),
      }).where(eq(schema.user.id, member.userId));

      if (member.profileId) {
        await tx.update(schema.brokerProfiles).set({
          professionalName: input.name,
          invitedEmail: input.email || null,
          updatedAt: new Date(),
        }).where(and(
          eq(schema.brokerProfiles.id, member.profileId),
          eq(schema.brokerProfiles.tenantId, context.tenantId),
        ));
      }

      await tx.update(schema.tenantMemberships).set({
        role: input.role,
        jobTitle: input.jobTitle,
        branchId: normalizedBranchId,
        customRoleId: input.customRoleId ?? null,
        // A broker who changes unit or stops being a broker leaves the supervisor's team.
        ...(input.role !== "broker" || normalizedBranchId !== member.branchId ? { supervisorId: null } : {}),
        updatedAt: new Date(),
      }).where(eq(schema.tenantMemberships.id, member.membershipId));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "tenant_membership", entidadeId: member.membershipId, acao: "atualizou_membro" });

      // The supervisor's team (brokers pointing to them through supervisor_id).
      if (input.role === "supervisor" && supervisedBrokerIds) {
        await syncSupervisedBrokers(tx, { tenantId: context.tenantId, actorId: context.userId, supervisorUserId: member.userId, supervisorBranchId: normalizedBranchId, brokerUserIds: supervisedBrokerIds });
      } else if (input.role !== "supervisor" && member.role === "supervisor") {
        await clearSupervisedBrokers(tx, { tenantId: context.tenantId, actorId: context.userId, supervisorUserId: member.userId });
      }

      const authorityChanged =
        member.role !== input.role ||
        member.jobTitle !== input.jobTitle ||
        member.branchId !== normalizedBranchId ||
        member.customRoleId !== (input.customRoleId ?? null);

      if (authorityChanged) {
        await tx.delete(schema.session).where(eq(schema.session.userId, member.userId));
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "tenant_membership",
          entidadeId: member.membershipId,
          acao: "revogou_sessoes_por_alteracao_de_autoridade",
        });
      }
    });

    invalidateTenantContextCache(); // role/unit/status changes apply at once
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao atualizar o membro.";
    return { success: false, error: message };
  }
}

export async function bulkToggleTeamMemberStatusAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const memberIds = formData.getAll("memberIds") as string[];
  const targetStatus = formData.get("targetStatus") as string;

  if (!memberIds.length) return { error: "Nenhum membro selecionado." };
  if (!targetStatus || !["active", "disabled"].includes(targetStatus)) {
    return { error: "Status inválido." };
  }

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const nextActive = targetStatus === "active";

    // 1. ATOMIC_DENY Pre-Validation: Verifica se todos os membros pertencem ao tenant e se o ator tem autoridade sobre cada um
    const memberRecords = [];
    for (const memberId of memberIds) {
      const [member] = await db
        .select({
          membershipId: schema.tenantMemberships.id,
          userId: schema.user.id,
          role: schema.tenantMemberships.role,
          branchId: schema.tenantMemberships.branchId,
          status: schema.user.status,
        })
        .from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .where(
          and(
            eq(schema.tenantMemberships.id, memberId),
            eq(schema.tenantMemberships.tenantId, context.tenantId),
          ),
        )
        .limit(1);

      if (!member) {
        return { error: `Membro ${memberId} não encontrado ou não pertence a este tenant.` };
      }

      if (!canManageMember(context, { role: member.role, branchId: member.branchId, userId: member.userId })) {
        return { error: `Você não tem permissão para alterar o status do membro ${memberId}.` };
      }

      memberRecords.push(member);
    }

    let updatedCount = 0;
    for (const member of memberRecords) {
      await db.transaction(async (tx) => {
        await tx.update(schema.user).set({
          active: nextActive,
          status: nextActive ? "active" : "disabled",
          updatedAt: new Date(),
        }).where(eq(schema.user.id, member.userId));

        await tx.update(schema.tenantMemberships).set({
          status: nextActive ? "active" : "inactive",
          updatedAt: new Date(),
        }).where(eq(schema.tenantMemberships.id, member.membershipId));

        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "tenant_membership",
          entidadeId: member.membershipId,
          acao: nextActive ? "reativou_membro" : "desativou_membro",
        });

        if (!nextActive) {
          await detachFromSupervision(tx, { tenantId: context.tenantId, actorId: context.userId, userId: member.userId });
          await tx.delete(schema.session).where(eq(schema.session.userId, member.userId));
        }
      });
      updatedCount++;
    }


    return {
      success: true,
      message: `${updatedCount} membro${updatedCount === 1 ? "" : "s"} ${nextActive ? "ativado" : "desativado"}${updatedCount === 1 ? "" : "s"} com sucesso.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao atualizar membros em lote.",
    };
  }
}

export async function toggleTeamMemberStatusAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const { memberId } = memberIdInput.parse(Object.fromEntries(formData));
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [member] = await db
      .select({
        membershipId: schema.tenantMemberships.id,
        userId: schema.user.id,
        role: schema.tenantMemberships.role,
        branchId: schema.tenantMemberships.branchId,
        status: schema.user.status,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(
        and(
          eq(schema.tenantMemberships.id, memberId),
          eq(schema.tenantMemberships.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new Error("Membro nao encontrado.");
    }

    requireCanManageMember(context, {
      role: member.role,
      branchId: member.branchId,
      userId: member.userId,
    });

    const nextActive = member.status !== "active";

    await db.transaction(async (tx) => {
      await tx.update(schema.user).set({
        active: nextActive,
        status: nextActive ? "active" : "disabled",
        updatedAt: new Date(),
      }).where(eq(schema.user.id, member.userId));

      await tx.update(schema.tenantMemberships).set({
        status: nextActive ? "active" : "inactive",
        updatedAt: new Date(),
      }).where(eq(schema.tenantMemberships.id, member.membershipId));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "tenant_membership", entidadeId: member.membershipId, acao: nextActive ? "reativou_membro" : "desativou_membro" });

      // Revogar sessões ao desativar membro
      if (!nextActive) {
        await tx.delete(schema.session).where(eq(schema.session.userId, member.userId));
        await detachFromSupervision(tx, { tenantId: context.tenantId, actorId: context.userId, userId: member.userId });
      }
    });

    invalidateTenantContextCache(); // role/unit/status changes apply at once
    return { success: true, status: nextActive ? "active" : "disabled" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao atualizar o status.";
    return { success: false, error: message };
  }
}

export async function deleteTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const { memberId } = memberIdInput.parse(Object.fromEntries(formData));
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [member] = await db
      .select({
        membershipId: schema.tenantMemberships.id,
        userId: schema.user.id,
        role: schema.tenantMemberships.role,
        branchId: schema.tenantMemberships.branchId,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(
        and(
          eq(schema.tenantMemberships.id, memberId),
          eq(schema.tenantMemberships.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (member) {
      requireCanManageMember(context, { role: member.role, branchId: member.branchId, userId: member.userId });

      // ── Buscar leads atribuídos ao corretor antes de excluí-lo ──────────
      const assignedLeads = await db
        .select({ id: schema.leads.id, branchId: schema.leads.branchId })
        .from(schema.leads)
        .where(
          and(
            eq(schema.leads.tenantId, context.tenantId),
            eq(schema.leads.corretorId, member.userId),
          ),
        );

      const [profile] = await db.select({ id: schema.brokerProfiles.id }).from(schema.brokerProfiles).where(and(eq(schema.brokerProfiles.tenantId, context.tenantId), eq(schema.brokerProfiles.userId, member.userId))).limit(1);

      await db.transaction(async (tx) => {
        // ── Desatribuir leads e registrar histórico ────────────────────────
        if (assignedLeads.length > 0) {
          const now = new Date();
          await tx
            .update(schema.leads)
            .set({
              corretorId: null,
              dutyScheduleId: null,
              distributionStatus: "returned_to_queue",
              assignedAt: null,
              distributionUpdatedAt: now,
            })
            .where(
              and(
                eq(schema.leads.tenantId, context.tenantId),
                eq(schema.leads.corretorId, member.userId),
              ),
            );

          for (const lead of assignedLeads) {
            await tx.insert(schema.leadInteractions).values({
              id: randomUUID(),
              leadId: lead.id,
              userId: context.userId,
              tipo: "system_alert",
              conteudo: "Um corretor foi excluído e este lead foi devolvido à fila da unidade para reatribuição manual.",
            });

            await tx.insert(schema.leadDistributionEvents).values({
              id: randomUUID(),
              tenantId: context.tenantId,
              leadId: lead.id,
              fromBranchId: lead.branchId,
              toBranchId: lead.branchId,
              previousOwnerId: member.userId,
              newOwnerId: null,
              action: "returned_to_queue",
              source: "redistribution",
              strategy: "manual",
              reason: "Corretor excluído",
              actorId: context.userId,
              createdAt: now,
            });

            await tx.insert(schema.auditLogs).values({
              id: randomUUID(),
              userId: context.userId,
              entidade: "lead",
              entidadeId: lead.id,
              acao: "lead.returned_to_queue",
            });
          }
        }

        // ── Registrar auditoria da exclusão do membro ──────────────────────
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "tenant_membership",
          entidadeId: member.membershipId,
          acao: "excluiu_membro",
        });

        // ── Excluir o membro (mesma lógica anterior) ───────────────────────
        if (profile) await tx.delete(schema.brokerInvitations).where(and(eq(schema.brokerInvitations.tenantId, context.tenantId), eq(schema.brokerInvitations.brokerProfileId, profile.id)));
        if (profile) await tx.delete(schema.brokerProfiles).where(and(eq(schema.brokerProfiles.id, profile.id), eq(schema.brokerProfiles.tenantId, context.tenantId)));
        await detachFromSupervision(tx, { tenantId: context.tenantId, actorId: context.userId, userId: member.userId });
        await tx.delete(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.id, member.membershipId), eq(schema.tenantMemberships.tenantId, context.tenantId)));
        await tx.delete(schema.session).where(eq(schema.session.userId, member.userId));
      });
    } else {
      const [profile] = await db.select({ id: schema.brokerProfiles.id, branchId: schema.brokerProfiles.branchId, userId: schema.brokerProfiles.userId, invitedEmail: schema.brokerProfiles.invitedEmail }).from(schema.brokerProfiles).where(and(eq(schema.brokerProfiles.id, memberId), eq(schema.brokerProfiles.tenantId, context.tenantId))).limit(1);
      if (!profile) throw new Error("Membro não encontrado.");
      requireCanManageMember(context, { role: "broker", branchId: profile.branchId, userId: profile.userId ?? profile.id });
      await db.transaction(async (tx) => {
        await tx.delete(schema.brokerInvitations).where(and(eq(schema.brokerInvitations.tenantId, context.tenantId), eq(schema.brokerInvitations.brokerProfileId, profile.id)));
        await tx.delete(schema.brokerProfiles).where(and(eq(schema.brokerProfiles.id, profile.id), eq(schema.brokerProfiles.tenantId, context.tenantId)));
      });
    }

    invalidateTenantContextCache(); // role/unit/status changes apply at once
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao excluir o membro.";
    return { success: false, error: message };
  }
}

const transferLeadsInput = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
});

export async function transferLeadsAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const input = transferLeadsInput.parse(Object.fromEntries(formData));
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") throw new Error("Apenas Diretores e Gestores podem transferir carteiras.");
    if ((await getSystemSetting("feature_lead_management_actions_enabled")) === "false") throw new Error("As ações de gestão de leads estão desativadas pelo Super-admin.");
    const db = getDatabase();

    const members = await db
      .select({ userId: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId, role: schema.tenantMemberships.role, status: schema.tenantMemberships.status, userActive: schema.user.active, userStatus: schema.user.status })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          inArray(schema.tenantMemberships.userId, [input.fromUserId, input.toUserId])
        )
      );

    if (members.length < 2) {
      throw new Error("Os usuários de origem e destino devem pertencer ao mesmo tenant.");
    }

    const source = members.find((member) => member.userId === input.fromUserId);
    const target = members.find((member) => member.userId === input.toUserId);
    if (!source || !target || source.role !== "broker" || target.role !== "broker" || target.status !== "active" || !target.userActive || target.userStatus !== "active" || !target.branchId) {
      throw new Error("Selecione um corretor de destino ativo no mesmo tenant.");
    }
    if (context.role === "manager" && (source.branchId !== context.branchId || target.branchId !== context.branchId)) {
      throw new Error("Gestores só podem transferir leads entre corretores da unidade autorizada.");
    }

    const [targetBranch] = await db.select({ id: schema.branches.id, status: schema.branches.status, acceptingLeads: schema.branches.acceptingLeads, isDistributionHub: schema.branches.isDistributionHub })
      .from(schema.branches).where(and(eq(schema.branches.id, target.branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1);
    if (!targetBranch) throw new Error("A unidade do corretor de destino não está ativa e apta a receber leads.");
    const targetQueueId = await ensureDefaultQueue(context.tenantId, target.branchId, context.userId);
    // DEC-133 (Pós Venda): com origem OU destino na Pós Venda, a isenção
    // dispensa a exigência de unidade ativa/aceitando leads na transferência
    // de carteira; a salvaguarda de membro ativo no tenant já foi feita acima.
    const postSaleExemptQueueName = await findPostSaleExemptionQueueName({ tenantId: context.tenantId, targetQueueId }).catch(() => null);
    if (!postSaleExemptQueueName && (targetBranch.status !== "active" || !targetBranch.acceptingLeads || targetBranch.isDistributionHub)) throw new Error("A unidade do corretor de destino não está ativa e apta a receber leads.");

    const leadsToTransfer = await db.select({
      id: schema.leads.id,
      branchId: schema.leads.branchId,
      queueId: schema.leads.queueId,
      status: schema.leads.status,
      distributionStatus: schema.leads.distributionStatus,
      firstContactAt: schema.leads.firstContactAt,
      serviceStartedAt: schema.leads.serviceStartedAt,
    }).from(schema.leads).where(and(
      eq(schema.leads.tenantId, context.tenantId),
      eq(schema.leads.corretorId, input.fromUserId),
      source.branchId ? eq(schema.leads.branchId, source.branchId) : sql`true`,
      isNull(schema.leads.archivedAt),
      isNull(schema.leads.deletedAt),
    ));
    const assignedAt = new Date();
    const [tenantPolicy] = await db.select({ feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled, feedbackGraceMinutes: schema.tenants.feedbackGraceMinutes, slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
    await db.transaction(async (tx) => {
      for (const lead of leadsToTransfer) {
        const activeLead = !["lost", "converted"].includes(lead.status);
        const transferred = await tx.update(schema.leads).set({
          branchId: target.branchId,
          queueId: targetQueueId,
          dutyScheduleId: null,
          corretorId: input.toUserId,
          assignedAt: activeLead ? assignedAt : undefined,
          firstContactAt: activeLead ? null : lead.firstContactAt,
          serviceStartedAt: activeLead ? null : lead.serviceStartedAt,
          serviceStartedBy: activeLead ? null : undefined,
          status: activeLead ? "distributed" : lead.status,
          distributionStatus: activeLead ? "assigned" : lead.distributionStatus,
          assignmentSource: activeLead ? context.role === "director" ? "manual_director" : "manual_manager" : undefined,
          assignmentStrategy: activeLead ? "manual" : undefined,
          distributionUpdatedAt: activeLead ? assignedAt : undefined,
          stageEnteredAt: activeLead ? assignedAt : undefined,
        }).where(and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.id, lead.id),
          eq(schema.leads.corretorId, input.fromUserId),
        )).returning({ id: schema.leads.id });
        if (!transferred.length) continue;
        if (activeLead) {
          await tx.update(schema.leadAssignmentAttempts).set({ status: "released", releasedAt: assignedAt, releaseReason: "Transferência manual de carteira entre unidades; atendimento reiniciado." }).where(and(
            eq(schema.leadAssignmentAttempts.tenantId, context.tenantId),
            eq(schema.leadAssignmentAttempts.leadId, lead.id),
            eq(schema.leadAssignmentAttempts.status, "open"),
          ));
          if (tenantPolicy?.feedbackRequiredEnabled !== false) await tx.insert(schema.leadAssignmentAttempts).values({
            id: randomUUID(), tenantId: context.tenantId, leadId: lead.id, brokerId: input.toUserId, sequence: 1,
            assignedAt, feedbackDueAt: new Date(assignedAt.getTime() + ((Number.parseInt(tenantPolicy?.slaFirstContactMinutes ?? "15", 10) || 15) + (Number.parseInt(tenantPolicy?.feedbackGraceMinutes ?? "5", 10) || 5)) * 60_000),
            status: "open", createdAt: assignedAt,
          });
        }
        await tx.update(schema.leadOffers).set({ status: "CANCELLED", updatedAt: assignedAt }).where(and(
          eq(schema.leadOffers.tenantId, context.tenantId),
          eq(schema.leadOffers.leadId, lead.id),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ));
        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(), tenantId: context.tenantId, leadId: lead.id, fromBranchId: lead.branchId,
          toBranchId: target.branchId, fromQueueId: lead.queueId, toQueueId: targetQueueId,
          previousOwnerId: input.fromUserId, newOwnerId: input.toUserId, action: "assigned",
          source: context.role === "director" ? "manual_director" : "manual_manager", strategy: "manual",
          reason: postSaleExemptQueueName
            ? `Transferência manual de carteira com isenção da fila "${postSaleExemptQueueName}"; bloqueios de negócio dispensados (DEC-133).`
            : "Transferência manual de carteira entre unidades; fila e campanha não restringem a atribuição.",
          metadata: { assignmentScope: "manual_cross_unit_override", previousStatus: lead.status, serviceRestarted: activeLead },
          actorId: context.userId, createdAt: assignedAt,
        });
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: postSaleExemptQueueName ? postSaleTransferAuditAction(postSaleExemptQueueName) : "lead.manual_cross_unit_transfer" });
        if (activeLead) await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: "Atribuição transferida manualmente para outra unidade e corretor; atendimento e SLA reiniciados, com histórico preservado." });
      }
    });

    invalidateTenantContextCache(); // role/unit/status changes apply at once
    void publishLeadInvalidation({ tenantId: context.tenantId, actorId: context.userId, branchIds: [source.branchId, target.branchId].filter((id): id is string => Boolean(id)), brokerIds: [input.fromUserId, input.toUserId] }).catch(() => undefined);
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao transferir leads.";
    return { success: false, error: message };
  }
}

/** Busca convites pendentes associados a membros sem userId ativo */
export async function getPendingInvitesAction() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  return db.select({
    id: schema.brokerInvitations.id,
    brokerProfileId: schema.brokerInvitations.brokerProfileId,
    email: schema.brokerInvitations.email,
    status: schema.brokerInvitations.status,
    expiresAt: schema.brokerInvitations.expiresAt,
    deliveryStatus: schema.brokerInvitations.deliveryStatus,
    createdAt: schema.brokerInvitations.createdAt,
    name: schema.brokerProfiles.professionalName,
    phone: schema.brokerProfiles.phone,
  })
    .from(schema.brokerInvitations)
    .innerJoin(schema.brokerProfiles, eq(schema.brokerInvitations.brokerProfileId, schema.brokerProfiles.id))
    .where(
      and(
        eq(schema.brokerInvitations.tenantId, context.tenantId),
        eq(schema.brokerInvitations.status, "PENDING"),
      ),
    )
    .orderBy(schema.brokerInvitations.createdAt);
}

export async function resendInviteAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const result = await resendTeamInvitation(formData.get("memberId") ?? formData.get("invitationId"));
    invalidateTenantContextCache(); // role/unit/status changes apply at once
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao reenviar convite." };
  }
}

export async function revokeInviteAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const invitationId = String(formData.get("invitationId") ?? "").trim();
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [invitation] = await db
      .select({ id: schema.brokerInvitations.id, status: schema.brokerInvitations.status })
      .from(schema.brokerInvitations)
      .where(and(or(eq(schema.brokerInvitations.id, invitationId), eq(schema.brokerInvitations.brokerProfileId, invitationId)), eq(schema.brokerInvitations.tenantId, context.tenantId)))
      .limit(1);

    if (!invitation) throw new Error("Convite não encontrado.");

    await db
      .update(schema.brokerInvitations)
      .set({ status: "REVOKED", revokedAt: new Date() })
      .where(eq(schema.brokerInvitations.id, invitation.id));

    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "broker_invitation", entidadeId: invitation.id, acao: "revogou_convite" });
    invalidateTenantContextCache(); // role/unit/status changes apply at once
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao revogar convite." };
  }
}

export async function importBrokersAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState & { report?: string }> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      throw new Error("Não autorizado.");
    }
    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      throw new Error("Arquivo CSV inválido ou vazio.");
    }
    const text = await file.text();
    const headerLine = text.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
    const delimiter = headerLine.includes(";") ? ";" : ",";
    const rows = parseCsv(text, delimiter).map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.replace(/^\uFEFF/, "").trim().toLowerCase(), value]),
    ));
    if (rows.length === 0) throw new Error("O arquivo CSV deve conter um cabeçalho e pelo menos uma linha de dados.");
    const headers = Object.keys(rows[0]);
    if (!headers.includes("nome") || !headers.includes("telefone")) {
      throw new Error("O cabeçalho do CSV deve conter nome e telefone. E-mail, CPF e unidade são opcionais.");
    }

    const db = getDatabase();
    let imported = 0;
    let queued = 0;
    const errors: string[] = [];
    const createdInvitations: Array<{
      invitationId: string;
      branchId: string;
      phone: string;
      name: string;
    }> = [];
    const phonesInFile = new Set<string>();
    const emailsInFile = new Set<string>();

    await db.transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lineNumber = i + 2;
        const name = String(row.nome ?? "").trim();
        const email = String(row.email ?? "").trim().toLowerCase() || null;
        const phone = String(row.telefone ?? "").replace(/\D/g, "");
        const cpf = String(row.cpf ?? "").replace(/\D/g, "") || null;

        if (!name || phone.length < 10 || phone.length > 15) {
          errors.push(`Linha ${lineNumber}: informe nome e um telefone internacional válido.`);
          continue;
        }
        if (email && !z.string().email().safeParse(email).success) {
          errors.push(`Linha ${lineNumber}: e-mail inválido.`);
          continue;
        }
        if (phonesInFile.has(phone)) {
          errors.push(`Linha ${lineNumber}: telefone repetido no arquivo.`);
          continue;
        }
        if (email && emailsInFile.has(email)) {
          errors.push(`Linha ${lineNumber}: e-mail repetido no arquivo.`);
          continue;
        }
        phonesInFile.add(phone);
        if (email) emailsInFile.add(email);

        const [existingEmail] = email ? await tx
          .select({ id: schema.brokerProfiles.id })
          .from(schema.brokerProfiles)
          .where(and(eq(schema.brokerProfiles.invitedEmail, email), eq(schema.brokerProfiles.tenantId, context.tenantId)))
          .limit(1) : [];
        if (existingEmail) {
          errors.push(`Linha ${lineNumber}: e-mail ${email} já cadastrado.`);
          continue;
        }

        const [existingIdentity] = email ? await tx
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.email, email))
          .limit(1) : [];
        if (existingIdentity) {
          errors.push(`Linha ${lineNumber}: o e-mail ${email} já pertence a uma conta existente.`);
          continue;
        }

        const [existingPhone] = await tx
          .select({ id: schema.brokerProfiles.id })
          .from(schema.brokerProfiles)
          .where(and(eq(schema.brokerProfiles.phone, phone), eq(schema.brokerProfiles.tenantId, context.tenantId)))
          .limit(1);
        if (existingPhone) {
          errors.push(`Linha ${lineNumber}: telefone já cadastrado.`);
          continue;
        }

        const [existingCpf] = cpf ? await tx
          .select({ id: schema.brokerProfiles.id })
          .from(schema.brokerProfiles)
          .where(and(eq(schema.brokerProfiles.cpf, cpf), eq(schema.brokerProfiles.tenantId, context.tenantId)))
          .limit(1) : [];
        if (existingCpf) {
          errors.push(`Linha ${lineNumber}: CPF ${cpf} já cadastrado.`);
          continue;
        }

        let targetBranchId = context.branchId;
        if (context.role === "director") {
          const branchVal = String(row.unidade ?? "").trim();
          if (branchVal) {
            const [matchedBranch] = await tx
              .select({ id: schema.branches.id })
              .from(schema.branches)
              .where(
                and(
                  eq(schema.branches.tenantId, context.tenantId),
                  eq(schema.branches.status, "active"),
                  sql`(${schema.branches.id} = ${branchVal} or lower(${schema.branches.name}) = lower(${branchVal}))`
                )
              )
              .limit(1);
            if (matchedBranch) {
              targetBranchId = matchedBranch.id;
            } else {
              errors.push(`Linha ${lineNumber}: Unidade "${branchVal}" não encontrada.`);
              continue;
            }
          } else {
            const [firstBranch] = await tx
              .select({ id: schema.branches.id })
              .from(schema.branches)
              .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
              .limit(1);
            if (firstBranch) {
              targetBranchId = firstBranch.id;
            } else {
              errors.push(`Linha ${lineNumber}: Nenhuma filial ativa cadastrada.`);
              continue;
            }
          }
        }

        if (!targetBranchId) {
          errors.push(`Linha ${lineNumber}: Unidade não especificada.`);
          continue;
        }

        const internalCode = await generateNextInternalCode(tx, context.tenantId);
        const brokerProfileId = randomUUID();

        await tx.insert(schema.brokerProfiles).values({
          id: brokerProfileId,
          tenantId: context.tenantId,
          branchId: targetBranchId,
          userId: null,
          internalCode,
          professionalName: name,
          phone,
          invitedEmail: email,
          cpf,
          lifecycleStatus: "INVITED",
          managerId: context.userId,
          invitedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const invitation = await createBrokerInvitation(
          tx,
          context.tenantId,
          targetBranchId,
          brokerProfileId,
          email,
          "broker",
          "broker",
        );
        createdInvitations.push({ invitationId: invitation.id, branchId: targetBranchId, phone, name });

        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "broker_profile",
          entidadeId: brokerProfileId,
          acao: "importou_corretor_pendente",
        });

        imported++;
      }
    });

    for (const invitation of createdInvitations) {
      const status = await enqueueBrokerInvitation({
        tenantId: context.tenantId,
        branchId: invitation.branchId,
        invitationId: invitation.invitationId,
        destinationPhone: invitation.phone,
        name: invitation.name,
        jobTitle: "broker",
        role: "broker",
        requestedBy: context.userId,
        scheduleDelivery: false,
      });
      if (status === "queued") queued += 1;
    }
    if (queued > 0) {
      scheduleAfterResponse("team-csv-invitation-outbound", () => processMetaOutboundBatch(3, context.tenantId));
    }

    let reportMessage = `Importação concluída. ${imported} corretores ficaram pendentes de ativação; ${queued} convites foram enfileirados no WhatsApp oficial.`;
    if (errors.length > 0) {
      reportMessage += ` Erros encontrados:\n${errors.join("\n")}`;
    }
    invalidateTenantContextCache(); // role/unit/status changes apply at once
    return { success: true, report: reportMessage };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao importar.";
    return { success: false, error: message };
  }
}

export async function generateResetPasswordLinkAction(
  _prev: TeamActionState & { resetUrl?: string },
  formData: FormData,
): Promise<TeamActionState & { resetUrl?: string }> {
  try {
    const userId = String(formData.get("userId") ?? "").trim();
    if (!userId) throw new Error("ID do usuário é obrigatório.");

    const result = await generatePasswordResetLinkForMember(userId);
    invalidateTenantContextCache(); // role/unit/status changes apply at once
    return { success: true, resetUrl: result.resetUrl };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar link de redefinição de senha.";
    return { success: false, error: message };
  }
}

