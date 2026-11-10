import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import type { getDatabase } from "@/shared/db";
import { schema } from "@/shared/db";

import { isScheduleExclusiveToUnit, MANAGER_SCOPE_ERROR, type ScheduleUnitFacts } from "./manager-unit-scope";

type Db = Pick<ReturnType<typeof getDatabase>, "select">;
type ManagerContext = { tenantId: string; role: string; branchId?: string | null };

/** Unidade do plantão, unidades do tipo e unidade de cada fila que recebe o plantão. */
export async function loadScheduleUnitFacts(db: Db, tenantId: string, scheduleIds: readonly string[]): Promise<Map<string, ScheduleUnitFacts>> {
  const ids = [...new Set(scheduleIds)];
  const facts = new Map<string, ScheduleUnitFacts>();
  if (!ids.length) return facts;
  const [schedules, queues] = await Promise.all([
    db.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId, typeBranchIds: schema.dutyScheduleTypes.branchIds, queueId: schema.unitDutySchedules.queueId })
      .from(schema.unitDutySchedules)
      .leftJoin(schema.dutyScheduleTypes, and(eq(schema.dutyScheduleTypes.id, schema.unitDutySchedules.typeId), eq(schema.dutyScheduleTypes.tenantId, schema.unitDutySchedules.tenantId)))
      .where(and(eq(schema.unitDutySchedules.tenantId, tenantId), inArray(schema.unitDutySchedules.id, ids))),
    db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId, exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds, exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId })
      .from(schema.leadQueues)
      .where(and(
        eq(schema.leadQueues.tenantId, tenantId),
        or(
          ...ids.map((id) => sql`${schema.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([id])}::jsonb`),
          inArray(schema.leadQueues.exclusiveDutyScheduleId, ids),
        ),
      )),
  ]);
  const legacyQueueIds = schedules.map((row) => row.queueId).filter((id): id is string => Boolean(id));
  const legacyQueues = legacyQueueIds.length
    ? await db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId }).from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, tenantId), inArray(schema.leadQueues.id, legacyQueueIds)))
    : [];
  const legacyBranch = new Map(legacyQueues.map((queue) => [queue.id, queue.branchId ?? null]));
  for (const row of schedules) {
    const queueBranchIds = queues
      .filter((queue) => (queue.exclusiveDutyScheduleIds ?? []).includes(row.id) || queue.exclusiveDutyScheduleId === row.id)
      .map((queue) => queue.branchId ?? null);
    if (row.queueId) queueBranchIds.push(legacyBranch.has(row.queueId) ? legacyBranch.get(row.queueId)! : null);
    facts.set(row.id, { branchId: row.branchId ?? null, typeBranchIds: Array.isArray(row.typeBranchIds) ? row.typeBranchIds : [], queueBranchIds });
  }
  return facts;
}

/** Ids dos plantões, entre os informados, que são exclusivos da unidade do gestor. */
export async function exclusiveScheduleIdsForManager(db: Db, context: ManagerContext, scheduleIds: readonly string[]): Promise<Set<string>> {
  if (context.role !== "manager" || !context.branchId) return new Set();
  const facts = await loadScheduleUnitFacts(db, context.tenantId, scheduleIds);
  return new Set([...facts].filter(([, fact]) => isScheduleExclusiveToUnit(fact, context.branchId)).map(([id]) => id));
}

/**
 * Mexer num plantão: só o diretor. Desde 10/11 o gestor (versão antiga) só acompanha os plantões da unidade, sem
 * alterar; a regra de exclusividade acima continua servindo às leituras.
 */
export async function assertScheduleInManagerUnit(_db: Db, context: ManagerContext, _scheduleId: string) {
  if (context.role === "director") return;
  if (context.role === "manager") throw new Error(MANAGER_SCOPE_ERROR);
  throw new Error("Sem permissão.");
}
