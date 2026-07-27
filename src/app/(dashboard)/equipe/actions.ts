"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { createTeamUser } from "@/features/team/create-user";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCanCreateRole, requireCanManageMember } from "@/shared/auth/team-permissions";
import { getDatabase, schema } from "@/shared/db";
import { generateNextInternalCode, createBrokerInvitation } from "@/features/team/onboarding-helpers";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";

// Pending invitations don't have a userId, they use brokerProfileId
type PendingInvite = {
  id: string;
  brokerProfileId: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  deliveryStatus: string | null;
  phone: string | null;
  name: string | null;
};

export type TeamActionState = { success?: boolean; error?: string; token?: string; invitationId?: string; whatsappStatus?: "queued" | "not_available" | "failed" | "sent"; status?: "active" | "disabled" };

const memberRole = z.enum(["manager", "broker"]);
const memberJobTitle = z.enum(schema.teamJobTitleValues);

const updateMemberInput = z.object({
  memberId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: memberRole,
  jobTitle: memberJobTitle,
  branchId: z.string().uuid(),
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
    revalidatePath("/equipe");
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
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [member] = await db
      .select({
        membershipId: schema.tenantMemberships.id,
        userId: schema.user.id,
        role: schema.tenantMemberships.role,
        jobTitle: schema.tenantMemberships.jobTitle,
        branchId: schema.tenantMemberships.branchId,
        status: schema.user.status,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(
        and(
          eq(schema.tenantMemberships.id, input.memberId),
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

    if (context.role === "manager" && context.branchId && input.branchId !== context.branchId) {
      throw new Error("Gestores so podem manter corretores na propria filial.");
    }

    requireCanCreateRole(context, input.role);

    const [branch] = await db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, input.branchId),
          eq(schema.branches.tenantId, context.tenantId),
          eq(schema.branches.status, "active"),
        ),
      )
      .limit(1);

    if (!branch) {
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

    await db.transaction(async (tx) => {
      await tx.update(schema.user).set({
        name: input.name,
        email: input.email,
        updatedAt: new Date(),
      }).where(eq(schema.user.id, member.userId));

      await tx.update(schema.tenantMemberships).set({
        role: input.role,
        jobTitle: input.jobTitle,
        branchId: input.branchId,
        updatedAt: new Date(),
      }).where(eq(schema.tenantMemberships.id, member.membershipId));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "tenant_membership", entidadeId: member.membershipId, acao: "atualizou_membro" });
    });

    revalidatePath("/equipe");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao atualizar o membro.";
    return { success: false, error: message };
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
      }
    });

    revalidatePath("/equipe");
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
      const [profile] = await db.select({ id: schema.brokerProfiles.id }).from(schema.brokerProfiles).where(and(eq(schema.brokerProfiles.tenantId, context.tenantId), eq(schema.brokerProfiles.userId, member.userId))).limit(1);
      await db.transaction(async (tx) => {
        if (profile) await tx.delete(schema.brokerInvitations).where(and(eq(schema.brokerInvitations.tenantId, context.tenantId), eq(schema.brokerInvitations.brokerProfileId, profile.id)));
        if (profile) await tx.delete(schema.brokerProfiles).where(and(eq(schema.brokerProfiles.id, profile.id), eq(schema.brokerProfiles.tenantId, context.tenantId)));
        await tx.delete(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.id, member.membershipId), eq(schema.tenantMemberships.tenantId, context.tenantId)));
        await tx.delete(schema.user).where(eq(schema.user.id, member.userId));
      });
    } else {
      const [profile] = await db.select({ id: schema.brokerProfiles.id, branchId: schema.brokerProfiles.branchId, userId: schema.brokerProfiles.userId }).from(schema.brokerProfiles).where(and(eq(schema.brokerProfiles.id, memberId), eq(schema.brokerProfiles.tenantId, context.tenantId))).limit(1);
      if (!profile) throw new Error("Membro não encontrado.");
      requireCanManageMember(context, { role: "broker", branchId: profile.branchId, userId: profile.userId ?? profile.id });
      await db.transaction(async (tx) => {
        await tx.delete(schema.brokerInvitations).where(and(eq(schema.brokerInvitations.tenantId, context.tenantId), eq(schema.brokerInvitations.brokerProfileId, profile.id)));
        await tx.delete(schema.brokerProfiles).where(and(eq(schema.brokerProfiles.id, profile.id), eq(schema.brokerProfiles.tenantId, context.tenantId)));
      });
    }

    revalidatePath("/equipe");
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
    const db = getDatabase();

    const members = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          inArray(schema.tenantMemberships.userId, [input.fromUserId, input.toUserId])
        )
      );

    if (members.length < 2) {
      throw new Error("Os usuários de origem e destino devem pertencer ao mesmo tenant.");
    }

    const [source] = await db.select({ role: schema.tenantMemberships.role, branchId: schema.tenantMemberships.branchId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, input.fromUserId)))
      .limit(1);
    const [target] = await db.select({ role: schema.tenantMemberships.role, branchId: schema.tenantMemberships.branchId, status: schema.tenantMemberships.status })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, input.toUserId)))
      .limit(1);
    if (!source || !target || source.role !== "broker" || target.role !== "broker" || target.status !== "active" || source.branchId !== target.branchId) {
      throw new Error("A transferência só pode ocorrer entre corretores ativos da mesma unidade.");
    }
    if (context.role === "manager" && source.branchId !== context.branchId) {
      throw new Error("Gestores só podem transferir leads dentro da própria unidade.");
    }

    await db
      .update(schema.leads)
      .set({ corretorId: input.toUserId, assignedAt: new Date() })
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, input.fromUserId)
        )
      );

    revalidatePath("/equipe");
    revalidatePath("/leads");
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
  const now = new Date();
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
    const invitationId = String(formData.get("invitationId") ?? "").trim();
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [invitation] = await db
      .select()
      .from(schema.brokerInvitations)
      .where(and(or(eq(schema.brokerInvitations.id, invitationId), eq(schema.brokerInvitations.brokerProfileId, invitationId)), eq(schema.brokerInvitations.tenantId, context.tenantId), eq(schema.brokerInvitations.status, "PENDING")))
      .limit(1);

    if (!invitation) throw new Error("Convite não encontrado.");
    if (invitation.status !== "PENDING") throw new Error("Este convite não está mais pendente.");
    if (invitation.expiresAt < new Date()) throw new Error("Convite expirado. Crie um novo acesso.");

    // Criar novo convite (substitui o anterior)
    const newInvite = await db.transaction(async (tx) => {
      const result = await createBrokerInvitation(
        tx,
        context.tenantId,
        invitation.branchId,
        invitation.brokerProfileId,
        invitation.email,
        invitation.role as "manager" | "broker",
        invitation.jobTitle,
      );
      // Re-enfileirar envio WhatsApp
      const [profile] = await tx
        .select({ phone: schema.brokerProfiles.phone, name: schema.brokerProfiles.professionalName })
        .from(schema.brokerProfiles)
        .where(eq(schema.brokerProfiles.id, invitation.brokerProfileId))
        .limit(1);
      return { ...result, phone: profile?.phone ?? null, name: profile?.name ?? null };
    });

    // Tentar enfileirar WhatsApp
    let whatsappStatus: TeamActionState["whatsappStatus"] = "not_available";
    if (newInvite.phone) {
      try {
        const [company] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
        const queued = await enqueueMetaTemplateMessage({
          tenantId: context.tenantId,
          recipientType: "user",
          recipientId: newInvite.id,
          destinationPhone: newInvite.phone,
          purpose: "brokerInvitation",
          variables: [newInvite.name ?? newInvite.id, company?.name ?? "sua corretora", invitation.role === "manager" ? "Gestor" : "Corretor"],
          requestedBy: context.userId,
          idempotencyKey: `team-invitation:${newInvite.id}`,
        });
        whatsappStatus = queued.duplicate || queued.status === "queued" ? "queued" : "failed";
        await processMetaOutboundBatch(10, context.tenantId);
        // A failed approved-template attempt can enqueue the text fallback.
        // Process that fallback in the same request instead of waiting for cron.
        const [delivery] = await db
          .select({ status: schema.brokerInvitations.deliveryStatus })
          .from(schema.brokerInvitations)
          .where(and(eq(schema.brokerInvitations.id, newInvite.id), eq(schema.brokerInvitations.tenantId, context.tenantId)))
          .limit(1);
        if (delivery?.status === "queued") await processMetaOutboundBatch(10, context.tenantId);
        const [finalDelivery] = await db
          .select({ status: schema.brokerInvitations.deliveryStatus })
          .from(schema.brokerInvitations)
          .where(and(eq(schema.brokerInvitations.id, newInvite.id), eq(schema.brokerInvitations.tenantId, context.tenantId)))
          .limit(1);
        if (finalDelivery?.status === "sent") whatsappStatus = "sent";
        else if (finalDelivery?.status === "failed") whatsappStatus = "failed";
      } catch {
        whatsappStatus = "failed";
      }
    }

    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "broker_invitation", entidadeId: newInvite.id, acao: "reenviou_convite" });
    revalidatePath("/equipe");
    return { success: true, token: newInvite.token, invitationId: newInvite.id, whatsappStatus };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao reenviar convite." };
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
    revalidatePath("/equipe");
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
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length <= 1) {
      throw new Error("O arquivo CSV deve conter um cabeçalho e pelo menos uma linha de dados.");
    }

    const headers = lines[0].toLowerCase().split(/[,;]/).map(h => h.trim());
    const nameIdx = headers.indexOf("nome");
    const emailIdx = headers.indexOf("email");
    const phoneIdx = headers.indexOf("telefone");
    const cpfIdx = headers.indexOf("cpf");
    const branchIdx = headers.indexOf("unidade");

    if (nameIdx === -1 || emailIdx === -1 || phoneIdx === -1) {
      throw new Error("O cabeçalho do CSV deve conter as colunas: nome, email, telefone, cpf.");
    }

    const db = getDatabase();
    let imported = 0;
    let errors: string[] = [];

    await db.transaction(async (tx) => {
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(/[,;]/).map(val => val.trim());
        if (row.length < 4) continue;

        const name = row[nameIdx];
        const email = row[emailIdx]?.toLowerCase();
        const phone = row[phoneIdx];
        const cpf = cpfIdx >= 0 ? row[cpfIdx]?.replace(/\D/g, "") || null : null;

        if (!name || !email || !phone) {
          errors.push(`Linha ${i + 1}: Dados incompletos.`);
          continue;
        }

        const [existingEmail] = await tx
          .select({ id: schema.brokerProfiles.id })
          .from(schema.brokerProfiles)
          .where(and(eq(schema.brokerProfiles.invitedEmail, email), eq(schema.brokerProfiles.tenantId, context.tenantId)))
          .limit(1);
        if (existingEmail) {
          errors.push(`Linha ${i + 1}: E-mail ${email} já cadastrado.`);
          continue;
        }

        const [existingCpf] = cpf ? await tx
          .select({ id: schema.brokerProfiles.id })
          .from(schema.brokerProfiles)
          .where(and(eq(schema.brokerProfiles.cpf, cpf), eq(schema.brokerProfiles.tenantId, context.tenantId)))
          .limit(1) : [];
        if (existingCpf) {
          errors.push(`Linha ${i + 1}: CPF ${cpf} já cadastrado.`);
          continue;
        }

        let targetBranchId = context.branchId;
        if (context.role === "director") {
          const branchVal = row[branchIdx];
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
              errors.push(`Linha ${i + 1}: Unidade "${branchVal}" não encontrada.`);
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
              errors.push(`Linha ${i + 1}: Nenhuma filial ativa cadastrada.`);
              continue;
            }
          }
        }

        if (!targetBranchId) {
          errors.push(`Linha ${i + 1}: Unidade não especificada.`);
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
          lifecycleStatus: "DRAFT",
          managerId: context.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "broker_profile",
          entidadeId: brokerProfileId,
          acao: "importou_corretor_draft",
        });

        imported++;
      }
    });

    revalidatePath("/equipe");

    let reportMessage = `Importação concluída. ${imported} corretores importados com sucesso como Rascunho (DRAFT).`;
    if (errors.length > 0) {
      reportMessage += ` Erros encontrados:\n${errors.join("\n")}`;
    }
    return { success: true, report: reportMessage };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao importar.";
    return { success: false, error: message };
  }
}
