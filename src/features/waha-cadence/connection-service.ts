import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";

import { createWahaRelaySession, disconnectWahaRelaySession, getWahaRelaySession, pauseWahaRelaySession, resumeWahaRelaySession } from "./relay-client";

export const WAHA_CONNECTIONS_FEATURE = "feature_waha_connections_enabled";
type Scope = "tenant" | "branch";

function canConfigure(context: Awaited<ReturnType<typeof getRequiredTenantContext>>) {
  return context.role === "director" || context.role === "manager"
    ? hasCapability(context.role, "acessar_configuracoes_unidade", context.jobTitle)
    : false;
}

function scopeFor(context: Awaited<ReturnType<typeof getRequiredTenantContext>>): Scope {
  if (context.role === "director") return "tenant";
  if (!context.branchId) throw new Error("O Gestor precisa estar vinculado a uma unidade ativa.");
  return "branch";
}

async function assertAvailable(context: Awaited<ReturnType<typeof getRequiredTenantContext>>) {
  if (!canConfigure(context)) throw new Error("Sem permissão para configurar números WAHA.");
  if (await getSystemSetting(WAHA_CONNECTIONS_FEATURE) === "false") throw new Error("A conexão WAHA está desativada pela plataforma.");
}

function whereOwnNumber(context: Awaited<ReturnType<typeof getRequiredTenantContext>>, id: string) {
  return and(
    eq(schema.wahaNumbers.id, id),
    eq(schema.wahaNumbers.tenantId, context.tenantId),
    context.role === "manager" ? eq(schema.wahaNumbers.branchId, context.branchId!) : undefined,
  );
}

export async function listOwnWahaConnections() {
  const context = await getRequiredTenantContext();
  await assertAvailable(context);
  return getDatabase().select({
    id: schema.wahaNumbers.id, label: schema.wahaNumbers.label, scope: schema.wahaNumbers.scope,
    status: schema.wahaNumbers.status, displayPhoneNumber: schema.wahaNumbers.displayPhoneNumber,
    relaySessionId: schema.wahaNumbers.relaySessionId, branchId: schema.wahaNumbers.branchId, capabilities: schema.wahaNumbers.capabilities,
    lastHealthAt: schema.wahaNumbers.lastHealthAt, lastErrorCode: schema.wahaNumbers.lastErrorCode,
  }).from(schema.wahaNumbers).where(and(eq(schema.wahaNumbers.tenantId, context.tenantId), context.role === "manager" ? eq(schema.wahaNumbers.branchId, context.branchId!) : undefined)).orderBy(desc(schema.wahaNumbers.createdAt));
}

export async function createOwnWahaConnection(input: { label: string }) {
  const context = await getRequiredTenantContext();
  await assertAvailable(context);
  const label = input.label.trim().slice(0, 80);
  if (label.length < 2) throw new Error("Informe um nome para identificar o número.");
  const scope = scopeFor(context);
  const id = randomUUID();
  const relaySessionId = `ancora-${context.tenantId.slice(0, 8)}-${id.slice(0, 8)}`.toLowerCase();
  const initial = await createWahaRelaySession(relaySessionId, {
    tenantId: context.tenantId,
    userId: context.userId,
  });
  const now = new Date();
  await getDatabase().insert(schema.wahaNumbers).values({
    id,
    relaySessionId,
    label,
    tenantId: context.tenantId,
    branchId: scope === "branch" ? context.branchId : null,
    scope,
    status: initial.status,
    displayPhoneNumber: initial.displayPhoneNumber ?? `Pendente (${id.slice(0, 6)})`,
    capabilities: { inbound: true, cadence: false, ai: false },
    createdBy: context.userId,
    lastHealthAt: now,
    updatedAt: now,
  });
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "waha_number",
    entidadeId: id,
    acao: `waha_connection.created:${scope}`,
    createdAt: now,
  });
  return { id, ...initial };
}

export async function updateOwnWahaCapabilities(id: string, input: { inbound: boolean; cadence: boolean; ai: boolean; brokerFallback?: boolean; qualificationFallback?: boolean }) {
  const context = await getRequiredTenantContext();
  await assertAvailable(context);
  if (input.ai && !input.inbound) throw new Error("A IA exige o recebimento de mensagens ativo.");
  const [number] = await getDatabase().select().from(schema.wahaNumbers).where(whereOwnNumber(context, id)).limit(1);
  if (!number) throw new Error("Número não encontrado.");
  const capabilities = {
    inbound: Boolean(input.inbound),
    cadence: Boolean(input.cadence),
    ai: Boolean(input.ai),
    brokerFallback: Boolean(input.brokerFallback),
    qualificationFallback: Boolean(input.qualificationFallback),
  };
  await getDatabase().update(schema.wahaNumbers).set({ capabilities, updatedAt: new Date() }).where(eq(schema.wahaNumbers.id, id));
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "waha_number", entidadeId: id, acao: `waha_connection.capabilities:${JSON.stringify(capabilities)}`, createdAt: new Date() });
  return capabilities;
}

export async function refreshOwnWahaConnection(id: string) {
  const context = await getRequiredTenantContext();
  await assertAvailable(context);
  const [number] = await getDatabase().select().from(schema.wahaNumbers).where(whereOwnNumber(context, id)).limit(1);
  if (!number) throw new Error("Número não encontrado.");
  const state = await getWahaRelaySession(number.relaySessionId);
  const now = new Date();
  await getDatabase().update(schema.wahaNumbers).set({ status: state.status, displayPhoneNumber: state.displayPhoneNumber ?? number.displayPhoneNumber, lastHealthAt: now, lastErrorCode: null, updatedAt: now }).where(eq(schema.wahaNumbers.id, id));
  return state;
}

export async function changeOwnWahaConnection(id: string, operation: "pause" | "resume" | "disconnect") {
  const context = await getRequiredTenantContext();
  await assertAvailable(context);
  const [number] = await getDatabase().select().from(schema.wahaNumbers).where(whereOwnNumber(context, id)).limit(1);
  if (!number) throw new Error("Número não encontrado.");

  if (operation === "disconnect") {
    await disconnectWahaRelaySession(number.relaySessionId).catch(() => null);
    await getDatabase().delete(schema.wahaNumbers).where(eq(schema.wahaNumbers.id, id));
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "waha_number",
      entidadeId: id,
      acao: `waha_connection.deleted:${number.scope}`,
      createdAt: new Date(),
    });
    return {
      sessionId: number.relaySessionId,
      status: "offline" as const,
      displayPhoneNumber: null,
      qrCode: null,
    };
  }

  if (operation === "pause") {
    const now = new Date();
    await getDatabase().update(schema.wahaNumbers).set({ status: "paused", lastHealthAt: now, updatedAt: now }).where(eq(schema.wahaNumbers.id, id));
    await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "waha_number", entidadeId: id, acao: `waha_connection.pause:${number.scope}`, createdAt: now });
    return {
      sessionId: number.relaySessionId,
      status: "paused" as const,
      displayPhoneNumber: number.displayPhoneNumber,
      qrCode: null,
    };
  }

  // operation === "resume"
  let stateStatus: "active" | "connecting" | "offline" | "error" = "active";
  try {
    const live = await getWahaRelaySession(number.relaySessionId);
    if (live.status === "active" || live.status === "connecting" || live.status === "offline" || live.status === "error") {
      stateStatus = live.status;
    }
  } catch {
    stateStatus = "active";
  }
  const now = new Date();
  await getDatabase().update(schema.wahaNumbers).set({ status: stateStatus, lastHealthAt: now, updatedAt: now }).where(eq(schema.wahaNumbers.id, id));
  if (stateStatus === "active") {
    await getDatabase().update(schema.whatsappOutboundMessages).set({
      status: "queued",
      providerErrorCode: null,
      providerErrorMessage: "Número WAHA retomado; aguardando novo envio.",
      nextAttemptAt: null,
      updatedAt: now,
    }).where(and(
      eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
      eq(schema.whatsappOutboundMessages.wahaNumberId, id),
      eq(schema.whatsappOutboundMessages.status, "pending"),
      eq(schema.whatsappOutboundMessages.providerErrorCode, "WAHA_INTERNAL_NUMBER_UNAVAILABLE"),
    ));
  }
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "waha_number", entidadeId: id, acao: `waha_connection.resume:${number.scope}`, createdAt: now });
  return {
    sessionId: number.relaySessionId,
    status: stateStatus,
    displayPhoneNumber: number.displayPhoneNumber,
    qrCode: null,
  };
}

export async function deleteOwnWahaConnection(id: string) {
  return changeOwnWahaConnection(id, "disconnect");
}
