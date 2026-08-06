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
  const initial = await createWahaRelaySession(relaySessionId);
  const now = new Date();
  await getDatabase().insert(schema.wahaNumbers).values({
    id, relaySessionId, label, tenantId: context.tenantId, branchId: scope === "branch" ? context.branchId : null,
    scope, status: initial.status, displayPhoneNumber: initial.displayPhoneNumber ?? "Aguardando leitura do QR",
    capabilities: { inbound: true, cadence: false, ai: false }, createdBy: context.userId, lastHealthAt: now, updatedAt: now,
  });
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(), userId: context.userId, entidade: "waha_number", entidadeId: id,
    acao: `waha_connection.created:${scope}`, createdAt: now,
  });
  return { id, ...initial };
}

export async function updateOwnWahaCapabilities(id: string, input: { inbound: boolean; cadence: boolean; ai: boolean }) {
  const context = await getRequiredTenantContext();
  await assertAvailable(context);
  if (input.ai && !input.inbound) throw new Error("A IA exige o recebimento de mensagens ativo.");
  const [number] = await getDatabase().select().from(schema.wahaNumbers).where(whereOwnNumber(context, id)).limit(1);
  if (!number) throw new Error("Número não encontrado.");
  const capabilities = { inbound: Boolean(input.inbound), cadence: Boolean(input.cadence), ai: Boolean(input.ai) };
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
  const state = operation === "pause" ? await pauseWahaRelaySession(number.relaySessionId) : operation === "resume" ? await resumeWahaRelaySession(number.relaySessionId) : await disconnectWahaRelaySession(number.relaySessionId);
  const now = new Date();
  await getDatabase().update(schema.wahaNumbers).set({ status: state.status, displayPhoneNumber: state.displayPhoneNumber ?? number.displayPhoneNumber, lastHealthAt: now, updatedAt: now }).where(eq(schema.wahaNumbers.id, id));
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "waha_number", entidadeId: id, acao: `waha_connection.${operation}:${number.scope}`, createdAt: now });
  return state;
}
