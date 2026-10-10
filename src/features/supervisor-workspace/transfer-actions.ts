"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const requestSchema = z.object({
  brokerId: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(1000),
});
const requestIdSchema = z.string().uuid();

export type TransferCandidate = { brokerId: string; brokerName: string; currentSupervisorId: string | null; currentSupervisorName: string };
export type PendingTransferRequest = {
  id: string;
  brokerId: string;
  brokerName: string;
  fromSupervisorId: string | null;
  fromSupervisorName: string;
  toSupervisorId: string;
  toSupervisorName: string;
  branchId: string;
  branchName: string;
  reason: string;
  createdAt: string;
};
export type TransferActionResult = { ok: true } | { ok: false; reason: string };

async function canManageBranch(context: Awaited<ReturnType<typeof getRequiredTenantContext>>, branchId: string) {
  if (context.role === "director") return true;
  if (context.role !== "manager") return false;
  if (context.branchId === branchId) return true;
  const [scope] = await getDatabase().select({ id: schema.tenantManagerBranches.id })
    .from(schema.tenantManagerBranches)
    .where(and(
      eq(schema.tenantManagerBranches.tenantId, context.tenantId),
      eq(schema.tenantManagerBranches.userId, context.userId),
      eq(schema.tenantManagerBranches.branchId, branchId),
    )).limit(1);
  return Boolean(scope);
}

export async function getBrokerTransferCandidatesAction(): Promise<TransferCandidate[]> {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId || (await getLiteAudience(context)) !== "supervisor") return [];
  const currentSupervisor = alias(schema.user, "current_transfer_supervisor");
  const currentSupervisorMembership = alias(schema.tenantMemberships, "current_transfer_supervisor_membership");
  return getDatabase().select({
    brokerId: schema.tenantMemberships.userId,
    brokerName: schema.user.name,
    currentSupervisorId: schema.tenantMemberships.supervisorId,
    currentSupervisorName: currentSupervisor.name,
  }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .innerJoin(currentSupervisor, eq(schema.tenantMemberships.supervisorId, currentSupervisor.id))
    .innerJoin(currentSupervisorMembership, and(
      eq(currentSupervisorMembership.tenantId, context.tenantId),
      eq(currentSupervisorMembership.userId, schema.tenantMemberships.supervisorId),
      eq(currentSupervisorMembership.role, "supervisor"),
      eq(currentSupervisorMembership.status, "active"),
      eq(currentSupervisorMembership.branchId, context.branchId),
      eq(currentSupervisor.status, "active"),
      eq(currentSupervisor.active, true),
    ))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.branchId, context.branchId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.user.status, "active"),
      eq(schema.user.active, true),
      isNotNull(schema.tenantMemberships.supervisorId),
      sql`${schema.tenantMemberships.supervisorId} <> ${context.userId}`,
      sql`not exists (
        select 1 from ${schema.supervisorTransferRequests} transfer_request
        where transfer_request.tenant_id = ${context.tenantId}
          and transfer_request.broker_id = ${schema.tenantMemberships.userId}
          and transfer_request.status = 'pending'
      )`,
    ))
    .orderBy(asc(schema.user.name));
}

async function notifyRequestRecipients(tenantId: string, branchId: string, oldSupervisorId: string, brokerId: string) {
  const managers = await getDatabase().select({ userId: schema.tenantMemberships.userId, role: schema.tenantMemberships.role, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(
      eq(schema.tenantMemberships.tenantId, tenantId),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.user.status, "active"),
      eq(schema.user.active, true),
      or(eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.role, "manager")),
    ));
  const branchManagerScopes = await getDatabase().select({ userId: schema.tenantManagerBranches.userId })
    .from(schema.tenantManagerBranches)
    .where(and(eq(schema.tenantManagerBranches.tenantId, tenantId), eq(schema.tenantManagerBranches.branchId, branchId)));
  const scopedManagers = new Set(branchManagerScopes.map((row) => row.userId));
  const recipients = new Set(managers.filter((row) => row.role === "director" || row.branchId === branchId || scopedManagers.has(row.userId)).map((row) => row.userId));
  recipients.add(oldSupervisorId);
  await Promise.all([...recipients].map((recipientUserId) => publishNotification({
    capability: "supervisor_transfer",
    tenantId,
    recipientUserId,
    type: "supervisor.transfer.requested",
    title: "Pedido de transferência de corretor",
    message: "Um supervisor pediu a transferência de um corretor entre equipes.",
    url: "/equipe",
    tag: `supervisor-transfer-${brokerId}`,
  })));
}

export async function requestBrokerTransferAction(input: unknown): Promise<TransferActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "Informe um motivo de até 1.000 caracteres." };
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId || (await getLiteAudience(context)) !== "supervisor") {
    return { ok: false, reason: "Ação disponível apenas para supervisores da unidade." };
  }
  const [actor] = await getDatabase().select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, context.userId),
      eq(schema.tenantMemberships.role, "supervisor"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.tenantMemberships.branchId, context.branchId),
      eq(schema.user.status, "active"),
      eq(schema.user.active, true),
    )).limit(1);
  if (!actor) return { ok: false, reason: "Seu vínculo de supervisor não está ativo." };

  const [broker] = await getDatabase().select({ userId: schema.tenantMemberships.userId, supervisorId: schema.tenantMemberships.supervisorId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, parsed.data.brokerId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.tenantMemberships.branchId, context.branchId),
      eq(schema.user.status, "active"),
      eq(schema.user.active, true),
      isNotNull(schema.tenantMemberships.supervisorId),
      sql`${schema.tenantMemberships.supervisorId} <> ${context.userId}`,
    )).limit(1);
  if (!broker?.supervisorId) return { ok: false, reason: "Corretor não está em outra equipe ativa da sua unidade." };

  const [currentSupervisor] = await getDatabase().select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, broker.supervisorId),
      eq(schema.tenantMemberships.role, "supervisor"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.tenantMemberships.branchId, context.branchId),
      eq(schema.user.status, "active"),
      eq(schema.user.active, true),
    )).limit(1);
  if (!currentSupervisor) return { ok: false, reason: "A equipe atual não está ativa nesta unidade." };

  const db = getDatabase();
  const requestId = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.supervisorTransferRequests).values({
        id: requestId,
        tenantId: context.tenantId,
        brokerId: parsed.data.brokerId,
        fromSupervisorId: broker.supervisorId,
        toSupervisorId: context.userId,
        branchId: context.branchId!,
        reason: parsed.data.reason,
        status: "pending",
      });
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "supervisor_transfer_request", entidadeId: requestId, acao: "supervisor_transfer.requested",
      });
    });
  } catch (error) {
    const databaseError = error as { code?: string; cause?: { code?: string } };
    if (databaseError.code === "23505" || databaseError.cause?.code === "23505") {
      return { ok: false, reason: "Já existe um pedido pendente para este corretor." };
    }
    return { ok: false, reason: "Não foi possível enviar o pedido. Tente novamente." };
  }

  try {
    await notifyRequestRecipients(context.tenantId, context.branchId, broker.supervisorId, parsed.data.brokerId);
  } catch {
    // The pending request is durable; notification delivery can be retried independently.
  }
  return { ok: true };
}

export async function getPendingBrokerTransferRequestsAction(): Promise<PendingTransferRequest[]> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") return [];
  const currentFrom = alias(schema.user, "transfer_from_supervisor");
  const requestedTo = alias(schema.user, "transfer_to_supervisor");
  const conditions = [eq(schema.supervisorTransferRequests.tenantId, context.tenantId), eq(schema.supervisorTransferRequests.status, "pending")];
  if (context.role === "manager") {
    const scopes = await getDatabase().select({ branchId: schema.tenantManagerBranches.branchId })
      .from(schema.tenantManagerBranches)
      .where(and(eq(schema.tenantManagerBranches.tenantId, context.tenantId), eq(schema.tenantManagerBranches.userId, context.userId)));
    const branchIds = new Set(scopes.map((row) => row.branchId));
    if (context.branchId) branchIds.add(context.branchId);
    if (!branchIds.size) return [];
    conditions.push(inArray(schema.supervisorTransferRequests.branchId, [...branchIds]));
  }
  const rows = await getDatabase().select({
    id: schema.supervisorTransferRequests.id,
    brokerId: schema.supervisorTransferRequests.brokerId,
    brokerName: schema.user.name,
    fromSupervisorId: schema.supervisorTransferRequests.fromSupervisorId,
    fromSupervisorName: sql<string>`coalesce(${currentFrom.name}, 'Equipe anterior')`,
    toSupervisorId: schema.supervisorTransferRequests.toSupervisorId,
    toSupervisorName: requestedTo.name,
    branchId: schema.supervisorTransferRequests.branchId,
    branchName: schema.branches.name,
    reason: schema.supervisorTransferRequests.reason,
    createdAt: schema.supervisorTransferRequests.createdAt,
  }).from(schema.supervisorTransferRequests)
    .innerJoin(schema.user, eq(schema.supervisorTransferRequests.brokerId, schema.user.id))
    .leftJoin(currentFrom, eq(schema.supervisorTransferRequests.fromSupervisorId, currentFrom.id))
    .innerJoin(requestedTo, eq(schema.supervisorTransferRequests.toSupervisorId, requestedTo.id))
    .innerJoin(schema.branches, and(eq(schema.supervisorTransferRequests.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
    .where(and(...conditions))
    .orderBy(asc(schema.supervisorTransferRequests.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function decideBrokerTransferAction(requestId: string, approve: boolean): Promise<TransferActionResult> {
  if (!requestIdSchema.safeParse(requestId).success || typeof approve !== "boolean") return { ok: false, reason: "Pedido inválido." };
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") return { ok: false, reason: "Ação disponível apenas para a gestão." };
  const db = getDatabase();
  const [scopeRequest] = await db.select({ branchId: schema.supervisorTransferRequests.branchId })
    .from(schema.supervisorTransferRequests)
    .where(and(
      eq(schema.supervisorTransferRequests.id, requestId),
      eq(schema.supervisorTransferRequests.tenantId, context.tenantId),
      eq(schema.supervisorTransferRequests.status, "pending"),
    )).limit(1);
  if (!scopeRequest || !(await canManageBranch(context, scopeRequest.branchId))) return { ok: false, reason: "Pedido não encontrado ou fora da sua unidade." };
  let decided: { brokerId: string; fromSupervisorId: string | null; toSupervisorId: string; branchId: string } | null = null;
  try {
    decided = await db.transaction(async (tx) => {
      const [request] = await tx.select({
        id: schema.supervisorTransferRequests.id,
        brokerId: schema.supervisorTransferRequests.brokerId,
        fromSupervisorId: schema.supervisorTransferRequests.fromSupervisorId,
        toSupervisorId: schema.supervisorTransferRequests.toSupervisorId,
        branchId: schema.supervisorTransferRequests.branchId,
      }).from(schema.supervisorTransferRequests)
        .where(and(
          eq(schema.supervisorTransferRequests.id, requestId),
          eq(schema.supervisorTransferRequests.tenantId, context.tenantId),
          eq(schema.supervisorTransferRequests.status, "pending"),
        )).for("update").limit(1);
      if (!request || request.branchId !== scopeRequest.branchId) throw new Error("PEDIDO_INDISPONIVEL");

      if (approve) {
        if (!request.fromSupervisorId) throw new Error("EQUIPE_ATUAL_INVALIDA");
        const [broker] = await tx.select({ userId: schema.tenantMemberships.userId })
          .from(schema.tenantMemberships)
          .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
          .where(and(
            eq(schema.tenantMemberships.tenantId, context.tenantId),
            eq(schema.tenantMemberships.userId, request.brokerId),
            eq(schema.tenantMemberships.role, "broker"),
            eq(schema.tenantMemberships.status, "active"),
            eq(schema.tenantMemberships.branchId, request.branchId),
            eq(schema.tenantMemberships.supervisorId, request.fromSupervisorId),
            eq(schema.user.status, "active"),
            eq(schema.user.active, true),
          )).limit(1);
        const [target] = await tx.select({ userId: schema.tenantMemberships.userId })
          .from(schema.tenantMemberships)
          .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
          .where(and(
            eq(schema.tenantMemberships.tenantId, context.tenantId),
            eq(schema.tenantMemberships.userId, request.toSupervisorId),
            eq(schema.tenantMemberships.role, "supervisor"),
            eq(schema.tenantMemberships.status, "active"),
            eq(schema.tenantMemberships.branchId, request.branchId),
            eq(schema.user.status, "active"),
            eq(schema.user.active, true),
          )).for("update").limit(1);
        if (!broker || !target) throw new Error("EQUIPE_ALTERADA");
        const [count] = await tx.select({ count: sql<number>`count(*)::int` })
          .from(schema.tenantMemberships)
          .where(and(
            eq(schema.tenantMemberships.tenantId, context.tenantId),
            eq(schema.tenantMemberships.supervisorId, request.toSupervisorId),
            eq(schema.tenantMemberships.branchId, request.branchId),
            eq(schema.tenantMemberships.role, "broker"),
            eq(schema.tenantMemberships.status, "active"),
          ));
        if ((count?.count ?? 0) >= 30) throw new Error("EQUIPE_CHEIA");
        const [moved] = await tx.update(schema.tenantMemberships).set({ supervisorId: request.toSupervisorId })
          .where(and(
            eq(schema.tenantMemberships.tenantId, context.tenantId),
            eq(schema.tenantMemberships.userId, request.brokerId),
            eq(schema.tenantMemberships.branchId, request.branchId),
            eq(schema.tenantMemberships.role, "broker"),
            eq(schema.tenantMemberships.status, "active"),
            eq(schema.tenantMemberships.supervisorId, request.fromSupervisorId),
          )).returning({ userId: schema.tenantMemberships.userId });
        if (!moved) throw new Error("EQUIPE_ALTERADA");
      }

      await tx.update(schema.supervisorTransferRequests).set({
        status: approve ? "approved" : "rejected",
        decidedBy: context.userId,
        decidedAt: new Date(),
      }).where(and(
        eq(schema.supervisorTransferRequests.id, requestId),
        eq(schema.supervisorTransferRequests.tenantId, context.tenantId),
        eq(schema.supervisorTransferRequests.status, "pending"),
      ));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "supervisor_transfer_request", entidadeId: requestId, acao: approve ? "supervisor_transfer.approved" : "supervisor_transfer.rejected",
      });
      return { brokerId: request.brokerId, fromSupervisorId: request.fromSupervisorId, toSupervisorId: request.toSupervisorId, branchId: request.branchId };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reason = message === "EQUIPE_CHEIA" ? "A equipe de destino já tem 30 corretores."
      : message === "EQUIPE_ALTERADA" || message === "EQUIPE_ATUAL_INVALIDA" ? "A equipe do corretor mudou. Atualize os pedidos."
        : "Pedido não encontrado ou fora da sua unidade.";
    return { ok: false, reason };
  }

  const recipients = new Set([decided.fromSupervisorId, decided.toSupervisorId].filter((id): id is string => Boolean(id)));
  await Promise.all([...recipients].map((recipientUserId) => publishNotification({
    capability: "supervisor_transfer",
    tenantId: context.tenantId,
    recipientUserId,
    type: approve ? "supervisor.transfer.approved" : "supervisor.transfer.rejected",
    title: approve ? "Transferência aprovada" : "Pedido de transferência recusado",
    message: approve ? "A gestão aprovou a transferência do corretor entre equipes." : "A gestão recusou o pedido de transferência do corretor.",
    url: "/equipe",
    tag: `supervisor-transfer-${decided.brokerId}`,
  }).catch(() => undefined)));
  return { ok: true };
}
