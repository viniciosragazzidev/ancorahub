import "server-only";

import { and, count, desc, eq, gte, inArray, type SQL } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { AI_RUN_FAILURE_STATUSES } from "./ai-runs-copy";

/**
 * Últimas execuções da IA (/ia/execucoes): cada chamada gravada em ai_attendance_logs, sempre só da empresa de quem
 * pede. O nome do lead vem por junção presa à mesma empresa.
 */

export const AI_RUNS_PAGE_SIZE = 25;
export const AI_RUNS_SUMMARY_HOURS = 24;

export type AiRunRow = {
  id: string;
  createdAt: string | null;
  leadId: string | null;
  leadName: string | null;
  purpose: string;
  model: string;
  status: string;
  latencyMs: number;
  totalTokens: number;
  estimatedCost: string;
  errorMessage: string | null;
};

/** Filtro da consulta: empresa sempre; "Só falhas" e janela de tempo quando pedidos. */
export function aiRunsWhere(tenantId: string, options: { onlyFailures?: boolean; since?: Date } = {}): SQL {
  const parts: SQL[] = [eq(schema.aiAttendanceLogs.tenantId, tenantId)];
  if (options.onlyFailures) parts.push(inArray(schema.aiAttendanceLogs.status, [...AI_RUN_FAILURE_STATUSES]));
  if (options.since) parts.push(gte(schema.aiAttendanceLogs.createdAt, options.since));
  return and(...parts)!;
}

export async function listAiRuns(tenantId: string, options: { onlyFailures?: boolean; page?: number; pageSize?: number } = {}) {
  const db = getDatabase();
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? AI_RUNS_PAGE_SIZE));
  const requested = Math.max(1, Math.floor(options.page ?? 1));
  const where = aiRunsWhere(tenantId, { onlyFailures: options.onlyFailures });

  const [{ value: total } = { value: 0 }] = await db.select({ value: count() }).from(schema.aiAttendanceLogs).where(where);
  const totalItems = Number(total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(requested, totalPages);

  const rows = await db
    .select({
      id: schema.aiAttendanceLogs.id,
      createdAt: schema.aiAttendanceLogs.createdAt,
      leadId: schema.aiAttendanceLogs.leadId,
      leadName: schema.leads.nome,
      purpose: schema.aiAttendanceLogs.provider,
      model: schema.aiAttendanceLogs.modelUsed,
      status: schema.aiAttendanceLogs.status,
      latencyMs: schema.aiAttendanceLogs.latencyMs,
      totalTokens: schema.aiAttendanceLogs.totalTokens,
      estimatedCost: schema.aiAttendanceLogs.estimatedCost,
      errorMessage: schema.aiAttendanceLogs.errorMessage,
    })
    .from(schema.aiAttendanceLogs)
    .leftJoin(schema.leads, and(eq(schema.leads.id, schema.aiAttendanceLogs.leadId), eq(schema.leads.tenantId, tenantId)))
    .where(where)
    .orderBy(desc(schema.aiAttendanceLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((row): AiRunRow => ({
      id: row.id,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      leadId: row.leadId,
      leadName: row.leadName ?? null,
      purpose: row.purpose,
      model: row.model,
      status: row.status,
      latencyMs: Number(row.latencyMs ?? 0),
      totalTokens: Number(row.totalTokens ?? 0),
      estimatedCost: row.estimatedCost ?? "0",
      errorMessage: row.errorMessage ?? null,
    })),
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}

/** Execuções e falhas nas últimas 24 h (resumo do topo de /ia e /ia/execucoes). */
export async function getAiRunsSummary(tenantId: string, now = new Date()) {
  const db = getDatabase();
  const since = new Date(now.getTime() - AI_RUNS_SUMMARY_HOURS * 3_600_000);
  const [[all], [failed]] = await Promise.all([
    db.select({ value: count() }).from(schema.aiAttendanceLogs).where(aiRunsWhere(tenantId, { since })),
    db.select({ value: count() }).from(schema.aiAttendanceLogs).where(aiRunsWhere(tenantId, { since, onlyFailures: true })),
  ]);
  return { total: Number(all?.value ?? 0), failed: Number(failed?.value ?? 0) };
}

/** Leads com a IA atendendo agora (mesmos estados de "em atendimento" do hub de qualificação). */
export async function countActiveQualifications(tenantId: string) {
  const db = getDatabase();
  const [row] = await db
    .select({ value: count() })
    .from(schema.aiConversations)
    .where(and(eq(schema.aiConversations.tenantId, tenantId), inArray(schema.aiConversations.status, ["NEW", "IN_PROGRESS"])));
  return Number(row?.value ?? 0);
}
