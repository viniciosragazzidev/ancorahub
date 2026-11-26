import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { isLeadAnonymized } from "./data-subject";
import { lgpdRequestDueAt, pickOpenLgpdRequest, sortLgpdRequests, type LgpdRequestKind } from "./lgpd-requests";

const READY_TTL_MS = 60_000;
let readyCache: { value: boolean; at: number } | null = null;

/** A migration 0240 está aplicada? Sem ela, exportar e anonimizar seguem e só o registro do pedido fica de fora. */
export async function isLgpdRequestsReady(now = Date.now()): Promise<boolean> {
  if (readyCache && now - readyCache.at < READY_TTL_MS) return readyCache.value;
  const value = await getDatabase()
    .execute(sql`select to_regclass('public.lgpd_requests') is not null as ready`)
    .then((result) => {
      const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as { ready?: boolean }[];
      return Boolean(rows[0]?.ready);
    })
    .catch(() => false);
  readyCache = { value, at: now };
  return value;
}

type Database = ReturnType<typeof getDatabase>;
type Executor = Pick<Database, "select" | "insert" | "update">;

/**
 * Atendimento na ficha (exportar ou anonimizar): conclui o pedido aberto mais antigo do tipo; sem pedido aberto,
 * grava um já concluído (pedido e atendimento no mesmo momento). Devolve o id do pedido.
 */
export async function completeLgpdRequestFor(executor: Executor, input: { tenantId: string; leadId: string; kind: LgpdRequestKind; userId: string; reason: string | null; now: Date }) {
  const rows = await executor.select({ id: schema.lgpdRequests.id, kind: schema.lgpdRequests.kind, requestedAt: schema.lgpdRequests.requestedAt, completedAt: schema.lgpdRequests.completedAt })
    .from(schema.lgpdRequests)
    .where(and(eq(schema.lgpdRequests.tenantId, input.tenantId), eq(schema.lgpdRequests.leadId, input.leadId), eq(schema.lgpdRequests.kind, input.kind), isNull(schema.lgpdRequests.completedAt)));
  const open = pickOpenLgpdRequest(rows, input.kind);
  if (open) {
    await executor.update(schema.lgpdRequests).set({ completedAt: input.now, completedBy: input.userId, updatedAt: input.now })
      .where(and(eq(schema.lgpdRequests.id, open.id), eq(schema.lgpdRequests.tenantId, input.tenantId)));
    return { id: open.id, created: false };
  }
  const id = randomUUID();
  await executor.insert(schema.lgpdRequests).values({
    id,
    tenantId: input.tenantId,
    leadId: input.leadId,
    kind: input.kind,
    reason: input.reason,
    requestedAt: input.now,
    dueAt: lgpdRequestDueAt(input.now),
    completedAt: input.now,
    completedBy: input.userId,
    createdBy: input.userId,
  });
  return { id, created: true };
}

export type LgpdRequestRow = {
  id: string;
  leadId: string;
  holder: string;
  anonymized: boolean;
  kind: LgpdRequestKind;
  reason: string | null;
  requestedAt: string;
  dueAt: string;
  completedAt: string | null;
  completedByName: string | null;
};

const MAX_LISTED = 300;

/** Pedidos da empresa para a seção "LGPD": abertos primeiro, pelo prazo; depois os atendidos mais recentes. */
export async function listLgpdRequests(tenantId: string): Promise<{ ready: boolean; rows: LgpdRequestRow[] }> {
  if (!(await isLgpdRequestsReady())) return { ready: false, rows: [] };
  const rows = await getDatabase()
    .select({
      id: schema.lgpdRequests.id,
      leadId: schema.lgpdRequests.leadId,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      kind: schema.lgpdRequests.kind,
      reason: schema.lgpdRequests.reason,
      requestedAt: schema.lgpdRequests.requestedAt,
      dueAt: schema.lgpdRequests.dueAt,
      completedAt: schema.lgpdRequests.completedAt,
      completedByName: schema.user.name,
    })
    .from(schema.lgpdRequests)
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.lgpdRequests.leadId), eq(schema.leads.tenantId, schema.lgpdRequests.tenantId)))
    .leftJoin(schema.user, eq(schema.user.id, schema.lgpdRequests.completedBy))
    .where(eq(schema.lgpdRequests.tenantId, tenantId))
    .orderBy(desc(schema.lgpdRequests.requestedAt))
    .limit(MAX_LISTED);
  return {
    ready: true,
    rows: sortLgpdRequests(rows).map((row) => {
      const anonymized = isLeadAnonymized({ nome: row.nome, telefone: row.telefone });
      return {
        id: row.id,
        leadId: row.leadId,
        holder: row.nome,
        anonymized,
        kind: row.kind,
        reason: row.reason,
        requestedAt: row.requestedAt.toISOString(),
        dueAt: row.dueAt.toISOString(),
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        completedByName: row.completedByName ?? null,
      };
    }),
  };
}
