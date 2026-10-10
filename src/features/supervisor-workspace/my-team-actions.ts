"use server";

import { randomUUID } from "node:crypto";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { SUPERVISOR_MAX_BROKERS } from "@/features/team/supervised-brokers";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { addBrokerToSupervisorTeam } from "./team-membership-service";

const userIdSchema = z.string().trim().min(1).max(80);
const teamInput = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(280),
  imageUrl: z.string().max(204800).nullable().optional().refine((value) => !value || (
    Buffer.byteLength(value, "utf8") <= 204800 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  ), "Use uma imagem PNG, JPEG ou WebP de até 200 KB."),
});
const inviteInput = z.object({ brokerId: userIdSchema, message: z.string().trim().max(280).optional() });
const inviteIdInput = z.object({ inviteId: userIdSchema });

type ActionResult = { ok: true; message: string } | { ok: false; message: string };
type Tx = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

async function getSupervisorContext() {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId || (await getLiteAudience(context)) !== "supervisor") return null;
  return context;
}

async function notify(tenantId: string, recipientUserId: string, input: { title: string; message: string; url?: string; tag: string }) {
  await publishNotification({
    capability: "supervisor_team_invite",
    tenantId,
    recipientUserId,
    type: "supervisor_team_invite",
    title: input.title,
    message: input.message,
    pushTitle: input.title,
    pushBody: input.message,
    url: input.url ?? "/notificacoes",
    tag: input.tag,
  }).catch(() => undefined);
}

async function writeAudit(tx: Tx, userId: string, entidade: string, entidadeId: string, acao: string) {
  await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade, entidadeId, acao });
}

export async function saveMySupervisorTeamAction(rawInput: unknown): Promise<ActionResult> {
  const parsed = teamInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados da equipe." };
  const context = await getSupervisorContext();
  if (!context) return { ok: false, message: "Apenas o supervisor da unidade pode editar esta equipe." };
  const db = getDatabase();
  const [existing] = await db.select({ id: schema.supervisorTeams.id }).from(schema.supervisorTeams)
    .where(and(eq(schema.supervisorTeams.tenantId, context.tenantId), eq(schema.supervisorTeams.supervisorId, context.userId)))
    .limit(1);
  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      const [saved] = await tx.insert(schema.supervisorTeams).values({
        id: existing?.id ?? randomUUID(),
        tenantId: context.tenantId,
        supervisorId: context.userId,
        branchId: context.branchId!,
        name: parsed.data.name,
        description: parsed.data.description,
        imageUrl: parsed.data.imageUrl || null,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [schema.supervisorTeams.tenantId, schema.supervisorTeams.supervisorId],
        set: { branchId: context.branchId!, name: parsed.data.name, description: parsed.data.description, imageUrl: parsed.data.imageUrl || null, updatedAt: now },
      }).returning({ id: schema.supervisorTeams.id });
      // The id from the database: two saves at once both audit the same team.
      await writeAudit(tx, context.userId, "supervisor_team", saved!.id, existing ? "supervisor_team.profile_updated" : "supervisor_team.profile_created");
    });
  } catch {
    return { ok: false, message: "Não consegui salvar agora. Tente de novo em instantes." };
  }
  revalidatePath("/equipe/minha");
  revalidatePath("/dashboard");
  return { ok: true, message: "Perfil da equipe salvo." };
}

export async function inviteBrokerToMyTeamAction(rawInput: unknown): Promise<ActionResult> {
  const parsed = inviteInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: "Escolha um corretor válido." };
  const context = await getSupervisorContext();
  if (!context) return { ok: false, message: "Apenas o supervisor da unidade pode convidar corretores." };
  const db = getDatabase();
  try {
    const [team] = await db.select({ id: schema.supervisorTeams.id, name: schema.supervisorTeams.name }).from(schema.supervisorTeams)
      .where(and(eq(schema.supervisorTeams.tenantId, context.tenantId), eq(schema.supervisorTeams.supervisorId, context.userId), eq(schema.supervisorTeams.branchId, context.branchId!))).limit(1);
    if (!team) return { ok: false, message: "Crie o perfil da equipe antes de convidar." };
    const result = await db.transaction(async (tx) => {
      const [supervisor] = await tx.select({ id: schema.tenantMemberships.id }).from(schema.tenantMemberships)
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId), eq(schema.tenantMemberships.role, "supervisor"), eq(schema.tenantMemberships.status, "active"), eq(schema.tenantMemberships.branchId, context.branchId!)))
        .for("update");
      if (!supervisor) return { ok: false as const, message: "Seu acesso de supervisor não está ativo." };
      const [broker] = await tx.select({ userId: schema.tenantMemberships.userId, name: schema.user.name }).from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .where(and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.userId, parsed.data.brokerId),
          eq(schema.tenantMemberships.branchId, context.branchId!),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.status, "active"),
          eq(schema.user.status, "active"),
          eq(schema.user.active, true),
          isNull(schema.tenantMemberships.supervisorId),
        )).limit(1);
      if (!broker) return { ok: false as const, message: "Esse corretor não está mais livre na sua unidade." };
      const [alreadyPending] = await tx.select({ id: schema.supervisorTeamInvites.id }).from(schema.supervisorTeamInvites)
        .where(and(eq(schema.supervisorTeamInvites.tenantId, context.tenantId), eq(schema.supervisorTeamInvites.supervisorId, context.userId), eq(schema.supervisorTeamInvites.brokerId, parsed.data.brokerId), eq(schema.supervisorTeamInvites.status, "pending"))).limit(1);
      if (alreadyPending) return { ok: false as const, message: "Já existe um convite pendente para esse corretor." };
      const [activeCount] = await tx.select({ total: count() }).from(schema.tenantMemberships)
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.supervisorId, context.userId), eq(schema.tenantMemberships.branchId, context.branchId!), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active")));
      if (Number(activeCount?.total ?? 0) >= SUPERVISOR_MAX_BROKERS) return { ok: false as const, message: `Sua equipe já tem ${SUPERVISOR_MAX_BROKERS} corretores.` };
      const inviteId = randomUUID();
      await tx.insert(schema.supervisorTeamInvites).values({
        id: inviteId,
        tenantId: context.tenantId,
        branchId: context.branchId!,
        supervisorId: context.userId,
        brokerId: broker.userId,
        status: "pending",
        message: parsed.data.message || null,
      });
      await writeAudit(tx, context.userId, "supervisor_team_invite", inviteId, "supervisor_team_invite.created");
      return { ok: true as const, inviteId, brokerName: broker.name };
    });
    if (!result.ok) return result;
    await notify(context.tenantId, parsed.data.brokerId, {
      title: `Convite para a equipe ${team.name}`,
      message: "Abra as notificações para aceitar ou recusar o convite.",
      tag: `supervisor-team-invite-${result.inviteId}`,
    });
    revalidatePath("/equipe/minha");
    revalidatePath("/notificacoes");
    return { ok: true, message: `Convite enviado para ${result.brokerName}.` };
  } catch {
    return { ok: false, message: "Não consegui enviar o convite. Tente de novo em instantes." };
  }
}

export async function cancelMyTeamInviteAction(rawInviteId: unknown): Promise<ActionResult> {
  const parsed = inviteIdInput.safeParse({ inviteId: rawInviteId });
  if (!parsed.success) return { ok: false, message: "Convite inválido." };
  const context = await getSupervisorContext();
  if (!context) return { ok: false, message: "Apenas o supervisor pode cancelar este convite." };
  try {
    const row = await getDatabase().transaction(async (tx) => {
      const [cancelled] = await tx.update(schema.supervisorTeamInvites).set({ status: "cancelled", decidedAt: new Date() })
        .where(and(eq(schema.supervisorTeamInvites.tenantId, context.tenantId), eq(schema.supervisorTeamInvites.supervisorId, context.userId), eq(schema.supervisorTeamInvites.id, parsed.data.inviteId), eq(schema.supervisorTeamInvites.status, "pending")))
        .returning({ id: schema.supervisorTeamInvites.id, brokerId: schema.supervisorTeamInvites.brokerId });
      if (!cancelled) return null;
      await writeAudit(tx, context.userId, "supervisor_team_invite", cancelled.id, "supervisor_team_invite.cancelled");
      return cancelled;
    });
    if (!row) return { ok: false, message: "Esse convite não está mais pendente." };
    await notify(context.tenantId, row.brokerId, { title: "Convite cancelado", message: "O convite para a equipe foi cancelado.", tag: `supervisor-team-invite-cancelled-${row.id}` });
    revalidatePath("/equipe/minha");
    revalidatePath("/notificacoes");
    return { ok: true, message: "Convite cancelado." };
  } catch {
    return { ok: false, message: "Não consegui cancelar. Tente de novo em instantes." };
  }
}

export async function removeBrokerFromMyTeamAction(rawBrokerId: unknown): Promise<ActionResult> {
  const parsed = userIdSchema.safeParse(rawBrokerId);
  if (!parsed.success) return { ok: false, message: "Corretor inválido." };
  const context = await getSupervisorContext();
  if (!context) return { ok: false, message: "Apenas o supervisor pode remover membros da equipe." };
  try {
    const removed = await getDatabase().transaction(async (tx) => {
      const [row] = await tx.update(schema.tenantMemberships).set({ supervisorId: null, updatedAt: new Date() })
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, parsed.data), eq(schema.tenantMemberships.branchId, context.branchId!), eq(schema.tenantMemberships.supervisorId, context.userId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active")))
        .returning({ userId: schema.tenantMemberships.userId });
      if (!row) return null;
      await writeAudit(tx, context.userId, "supervisor_team", context.userId, `supervisor_team.member_removed:${row.userId}`);
      return row;
    });
    if (!removed) return { ok: false, message: "Esse corretor não faz mais parte da sua equipe." };
    revalidatePath("/equipe/minha");
    revalidatePath("/dashboard");
    return { ok: true, message: "Corretor removido da equipe." };
  } catch {
    return { ok: false, message: "Não consegui remover agora." };
  }
}

async function respondToInvite(rawInviteId: unknown, decision: "accepted" | "declined"): Promise<ActionResult> {
  const parsed = inviteIdInput.safeParse({ inviteId: rawInviteId });
  if (!parsed.success) return { ok: false, message: "Convite inválido." };
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return { ok: false, message: "Apenas o corretor convidado pode responder." };
  try {
    const result = await getDatabase().transaction(async (tx) => {
      const [invite] = await tx.select({ id: schema.supervisorTeamInvites.id, supervisorId: schema.supervisorTeamInvites.supervisorId, branchId: schema.supervisorTeamInvites.branchId })
        .from(schema.supervisorTeamInvites)
        .where(and(eq(schema.supervisorTeamInvites.tenantId, context.tenantId), eq(schema.supervisorTeamInvites.id, parsed.data.inviteId), eq(schema.supervisorTeamInvites.brokerId, context.userId), eq(schema.supervisorTeamInvites.status, "pending")))
        .for("update");
      if (!invite) return { ok: false as const, message: "Esse convite não está mais pendente." };
      const [broker] = await tx.select({ id: schema.tenantMemberships.id, supervisorId: schema.tenantMemberships.supervisorId, branchId: schema.tenantMemberships.branchId, role: schema.tenantMemberships.role, status: schema.tenantMemberships.status }).from(schema.tenantMemberships)
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId)))
        .for("update");
      if (decision === "accepted") {
        const unavailableReason = !broker || broker.role !== "broker" || broker.status !== "active"
          ? "O convite foi cancelado porque seu vínculo de corretor não está mais ativo."
          : broker.branchId !== invite.branchId
            ? "O convite foi cancelado porque você não está mais nesta unidade."
            : broker.supervisorId
              ? "O convite foi cancelado porque você já entrou em outra equipe."
              : null;
        if (unavailableReason) {
          await tx.update(schema.supervisorTeamInvites).set({ status: "cancelled", decidedAt: new Date() })
            .where(and(eq(schema.supervisorTeamInvites.tenantId, context.tenantId), eq(schema.supervisorTeamInvites.id, invite.id), eq(schema.supervisorTeamInvites.status, "pending")));
          await writeAudit(tx, context.userId, "supervisor_team_invite", invite.id, "supervisor_team_invite.cancelled_on_accept");
          return { ok: false as const, message: unavailableReason };
        }
        const attached = await addBrokerToSupervisorTeam(tx, {
          tenantId: context.tenantId,
          branchId: invite.branchId,
          supervisorId: invite.supervisorId,
          brokerId: context.userId,
          actor: context,
        });
        if (!attached.ok) {
          await tx.update(schema.supervisorTeamInvites).set({ status: "cancelled", decidedAt: new Date() })
            .where(and(eq(schema.supervisorTeamInvites.tenantId, context.tenantId), eq(schema.supervisorTeamInvites.id, invite.id), eq(schema.supervisorTeamInvites.status, "pending")));
          await writeAudit(tx, context.userId, "supervisor_team_invite", invite.id, "supervisor_team_invite.cancelled_on_accept");
          return { ok: false as const, message: attached.reason };
        }
      }
      await tx.update(schema.supervisorTeamInvites).set({ status: decision, decidedAt: new Date() })
        .where(and(eq(schema.supervisorTeamInvites.tenantId, context.tenantId), eq(schema.supervisorTeamInvites.id, invite.id), eq(schema.supervisorTeamInvites.status, "pending")));
      await writeAudit(tx, context.userId, "supervisor_team_invite", invite.id, `supervisor_team_invite.${decision}`);
      return { ok: true as const, supervisorId: invite.supervisorId };
    });
    if (!result.ok) return result;
    await notify(context.tenantId, result.supervisorId, {
      title: decision === "accepted" ? "Convite aceito" : "Convite recusado",
      message: decision === "accepted" ? "Um corretor aceitou o convite da equipe." : "Um corretor recusou o convite da equipe.",
      url: "/equipe/minha",
      tag: `supervisor-team-invite-${decision}-${parsed.data.inviteId}`,
    });
    revalidatePath("/notificacoes");
    revalidatePath("/equipe/minha");
    revalidatePath("/dashboard");
    return { ok: true, message: decision === "accepted" ? "Você entrou na equipe." : "Convite recusado." };
  } catch {
    return { ok: false, message: "Não consegui responder. Tente novamente mais tarde." };
  }
}

export async function acceptSupervisorTeamInviteAction(rawInviteId: unknown): Promise<ActionResult> {
  return respondToInvite(rawInviteId, "accepted");
}

export async function declineSupervisorTeamInviteAction(rawInviteId: unknown): Promise<ActionResult> {
  return respondToInvite(rawInviteId, "declined");
}
