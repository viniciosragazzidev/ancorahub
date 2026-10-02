"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isValidDutyWindow } from "./domain";
import { dutyScheduleInput, parseCreateDutyScheduleInput, parseDutyScheduleInput } from "./duty-schedule-input";
import { retimeAssignmentForSplit, validShiftSplit } from "./duty-shifts";
import { dayOfWeekOf, occurrenceValidity } from "./monthly-duty-plan";
import { sendDutyPresenceInviteManually, type ManualDutyPresenceInviteResult } from "./duty-presence";
import { wakeLeadsAwaitingEligibleBroker } from "./jobs";

export type DutyActionState = { success?: boolean; error?: string; message?: string; scheduleId?: string; scheduleIds?: string[] };


async function assertBatchDutyAccess() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas Diretores podem configurar plantões globais.");
  return { context, db: getDatabase() };
}

type ScheduleConflictInput = Pick<z.infer<typeof dutyScheduleInput>, "branchId" | "queueId" | "dayOfWeek" | "startsAt" | "endsAt"> & {
  // Global (branchId null) schedules only: which queue this one is meant to
  // serve. See assertNoScheduleConflict for why this changes the scoping.
  responsibleQueueId?: string | null;
  /** Validity of the new/edited rule: only rules whose periods overlap can collide. */
  validFrom?: Date;
  validUntil?: Date | null;
};

/** Existing rule's [validFrom, validUntil) overlaps the input's period. */
function overlapsValidity(input: Pick<ScheduleConflictInput, "validFrom" | "validUntil">) {
  return and(
    input.validUntil ? lt(schema.unitDutySchedules.validFrom, input.validUntil) : undefined,
    input.validFrom ? or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, input.validFrom)) : undefined,
  );
}

async function assertNoScheduleConflict(
  db: ReturnType<typeof getDatabase>,
  input: ScheduleConflictInput,
  tenantId: string,
  excludedScheduleId?: string,
) {
  const isGlobal = input.branchId === null || input.branchId === undefined;

  // Global plantões don't collide just by sharing a day/time — each queue's
  // own roster is independent, so two queues can run brokers at the same
  // hour. They only collide when they'd serve the SAME queue at once (which
  // one applies would be ambiguous). Without a chosen queue yet, fall back
  // to the old broad "any overlapping global plantão" check — we can't tell
  // which queue(s) an unlinked plantão might end up serving.
  // The responsible queue is not stored on the schedule — it lives in the
  // queues' exclusivity lists. When editing an existing schedule the form does
  // not resend it, so recover it from the queues that already link this
  // schedule; otherwise an edit would fall into the broad check below and
  // collide with the other queues' plantões.
  let queueIdsToCheck: string[] = input.responsibleQueueId ? [input.responsibleQueueId] : [];
  if (isGlobal && !queueIdsToCheck.length && excludedScheduleId) {
    const linked = await db
      .select({ id: schema.leadQueues.id })
      .from(schema.leadQueues)
      .where(and(
        eq(schema.leadQueues.tenantId, tenantId),
        sql`(${schema.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([excludedScheduleId])}::jsonb OR ${schema.leadQueues.exclusiveDutyScheduleId} = ${excludedScheduleId})`,
      ));
    queueIdsToCheck = linked.map((queue) => queue.id);
  }

  if (isGlobal && queueIdsToCheck.length) {
    const queues = await db
      .select({ exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds })
      .from(schema.leadQueues)
      .where(and(inArray(schema.leadQueues.id, queueIdsToCheck), eq(schema.leadQueues.tenantId, tenantId)));
    const scopedIds = Array.from(new Set(queues.flatMap((queue) => queue.exclusiveDutyScheduleIds ?? []))).filter((id) => id !== excludedScheduleId);
    if (!scopedIds.length) return;
    const [conflict] = await db
      .select({ id: schema.unitDutySchedules.id })
      .from(schema.unitDutySchedules)
      .where(and(
        eq(schema.unitDutySchedules.tenantId, tenantId),
        eq(schema.unitDutySchedules.dayOfWeek, input.dayOfWeek),
        eq(schema.unitDutySchedules.status, "active"),
        lt(schema.unitDutySchedules.startsAt, input.endsAt),
        gt(schema.unitDutySchedules.endsAt, input.startsAt),
        inArray(schema.unitDutySchedules.id, scopedIds),
        overlapsValidity(input),
      ))
      .limit(1);
    if (conflict) throw new Error("A fila responsável já tem um plantão ativo no mesmo horário.");
    return;
  }

  const conditions = [
    eq(schema.unitDutySchedules.tenantId, tenantId),
    eq(schema.unitDutySchedules.dayOfWeek, input.dayOfWeek),
    eq(schema.unitDutySchedules.status, "active"),
    lt(schema.unitDutySchedules.startsAt, input.endsAt),
    gt(schema.unitDutySchedules.endsAt, input.startsAt),
    overlapsValidity(input),
    isGlobal
      ? and(isNull(schema.unitDutySchedules.branchId), isNull(schema.unitDutySchedules.queueId))
      : and(eq(schema.unitDutySchedules.branchId, input.branchId as string), input.queueId ? eq(schema.unitDutySchedules.queueId, input.queueId) : isNull(schema.unitDutySchedules.queueId)),
  ];
  if (excludedScheduleId) conditions.push(ne(schema.unitDutySchedules.id, excludedScheduleId));

  const [conflict] = await db
    .select({ id: schema.unitDutySchedules.id })
    .from(schema.unitDutySchedules)
    .where(and(...conditions))
    .limit(1);
  if (conflict) {
    throw new Error(
      isGlobal
        ? "Já existe um plantão ativo no mesmo horário. Escolha a fila responsável para permitir horários sobrepostos em filas diferentes."
        : "Já existe um plantão ativo com o mesmo horário neste escopo.",
    );
  }
}

function validateSchedule(input: Pick<z.infer<typeof dutyScheduleInput>, "dayOfWeek" | "startsAt" | "endsAt" | "validFrom" | "validUntil">) {
  if (!isValidDutyWindow(input.dayOfWeek, input.startsAt, input.endsAt)) {
    throw new Error("Informe um horário válido. O fim deve ser depois do início.");
  }
  if (input.validUntil && input.validUntil < input.validFrom) {
    throw new Error("O fim da vigência não pode ser anterior ao início.");
  }
}

async function findScheduleForMutation(scheduleId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [schedule] = await db
    .select({
      id: schema.unitDutySchedules.id,
      tenantId: schema.unitDutySchedules.tenantId,
      branchId: schema.unitDutySchedules.branchId,
      queueId: schema.unitDutySchedules.queueId,
      name: schema.unitDutySchedules.name,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      priority: schema.unitDutySchedules.priority,
      minimumBrokers: schema.unitDutySchedules.minimumBrokers,
      maximumBrokers: schema.unitDutySchedules.maximumBrokers,
      maxLeadsPerBroker: schema.unitDutySchedules.maxLeadsPerBroker,
      shiftSplitAt: schema.unitDutySchedules.shiftSplitAt,
      typeId: schema.unitDutySchedules.typeId,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
      webhookCredentialId: schema.unitDutySchedules.webhookCredentialId,
      status: schema.unitDutySchedules.status,
    })
    .from(schema.unitDutySchedules)
    .where(and(eq(schema.unitDutySchedules.id, scheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .limit(1);
  if (!schedule) throw new Error("Plantão não encontrado.");
  if (context.role !== "director" && context.role !== "manager") throw new Error("Sem permissão.");
  if (context.role === "manager" && schedule.branchId && context.branchId !== schedule.branchId) {
    throw new Error("Plantão fora do seu escopo.");
  }
  return { context, db, schedule };
}

async function resolveDutyTypeId(tx: ReturnType<typeof getDatabase>, tenantId: string, userId: string, typeName: string | null | undefined) {
  if (!typeName?.trim()) return null;
  const normalizedName = typeName.trim().replace(/\s+/g, " ");
  return tx.transaction(async (dbtx) => {
    const [existing] = await dbtx.select({ id: schema.dutyScheduleTypes.id })
      .from(schema.dutyScheduleTypes)
      .where(and(eq(schema.dutyScheduleTypes.tenantId, tenantId), sql`lower(${schema.dutyScheduleTypes.name}) = lower(${normalizedName})`, eq(schema.dutyScheduleTypes.status, "active")))
      .limit(1);
    if (existing) return existing.id;
    const id = randomUUID();
    const [inserted] = await dbtx.insert(schema.dutyScheduleTypes).values({ id, tenantId, name: normalizedName, createdBy: userId }).onConflictDoNothing().returning({ id: schema.dutyScheduleTypes.id });
    if (inserted) {
      await dbtx.insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "duty_schedule_type", entidadeId: id, acao: "duty_schedule_type.created" });
      return id;
    }
    const [raced] = await dbtx.select({ id: schema.dutyScheduleTypes.id }).from(schema.dutyScheduleTypes)
      .where(and(eq(schema.dutyScheduleTypes.tenantId, tenantId), sql`lower(${schema.dutyScheduleTypes.name}) = lower(${normalizedName})`, eq(schema.dutyScheduleTypes.status, "active"))).limit(1);
    if (!raced) throw new Error("Não foi possível salvar o tipo do plantão.");
    return raced.id;
  });
}

/**
 * Makes `queueIds` (none, one or several) the queues that receive this
 * plantão, in the same exclusivity lists the Filas page edits: removed from
 * every other queue, appended to the chosen ones. Runs inside the caller's
 * transaction.
 */
async function relinkScheduleQueues(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  context: { tenantId: string; userId: string },
  scheduleId: string,
  queueIds: readonly string[],
) {
  const chosen = new Set(queueIds);
  const queues = await tx.select({ id: schema.leadQueues.id, exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds, exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId })
    .from(schema.leadQueues)
    .where(and(
      eq(schema.leadQueues.tenantId, context.tenantId),
      or(
        sql`${schema.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([scheduleId])}::jsonb`,
        eq(schema.leadQueues.exclusiveDutyScheduleId, scheduleId),
        chosen.size ? inArray(schema.leadQueues.id, [...chosen]) : undefined,
      ),
    ));
  const now = new Date();
  for (const queue of queues) {
    const current = Array.from(new Set([...(queue.exclusiveDutyScheduleIds ?? []), ...(queue.exclusiveDutyScheduleId ? [queue.exclusiveDutyScheduleId] : [])]));
    const next = chosen.has(queue.id)
      ? Array.from(new Set([...current, scheduleId]))
      : current.filter((id) => id !== scheduleId);
    if (next.length === current.length && next.every((id, index) => id === current[index])) continue;
    await tx.update(schema.leadQueues).set({ exclusiveDutyScheduleIds: next, exclusiveDutyScheduleId: next[0] ?? null, updatedAt: now })
      .where(and(eq(schema.leadQueues.id, queue.id), eq(schema.leadQueues.tenantId, context.tenantId)));
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "lead_queue", entidadeId: queue.id,
      acao: chosen.has(queue.id) ? "queue.duty_schedule_linked" : "queue.duty_schedule_unlinked",
    });
  }
}

/** The requested queues, each of the tenant and active (a missing or inactive one is refused). */
async function activeQueueIds(db: ReturnType<typeof getDatabase>, tenantId: string, requested: readonly string[]) {
  const ids = [...new Set(requested.filter(Boolean))];
  if (!ids.length) return [];
  const found = await db.select({ id: schema.leadQueues.id }).from(schema.leadQueues)
    .where(and(inArray(schema.leadQueues.id, ids), eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.status, "active")));
  if (found.length !== ids.length) throw new Error("Fila não encontrada ou inativa.");
  return ids;
}

function revalidateDutyWorkspace() {
}

export async function createDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const parsed = parseCreateDutyScheduleInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados do plantão." };
  try {
    const base = {
      branchId: null,
      queueId: null,
      name: parsed.data.name,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      minimumBrokers: parsed.data.minimumBrokers,
      maximumBrokers: parsed.data.maximumBrokers ?? null,
      maxLeadsPerBroker: parsed.data.maxLeadsPerBroker ?? null,
      shiftSplitAt: validShiftSplit(parsed.data, parsed.data.shiftSplitAt),
      webhookCredentialId: parsed.data.webhookCredentialId,
    };
    // "Datas": one plantão per chosen date, valid only on that day.
    // "Toda semana": one weekly rule per weekday over the whole period.
    const schedules = parsed.data.dates?.length
      ? parsed.data.dates.map((dutyDate) => ({ ...base, dayOfWeek: dayOfWeekOf(dutyDate), ...occurrenceValidity(dutyDate, "America/Sao_Paulo") }))
      : parsed.data.daysOfWeek.map((dayOfWeek) => ({ ...base, dayOfWeek, validFrom: parsed.data.validFrom, validUntil: parsed.data.validUntil }));
    for (const schedule of schedules) validateSchedule(schedule);
    const { context, db } = await assertBatchDutyAccess();
    const receivingQueueIds = await activeQueueIds(db, context.tenantId, [
      ...(parsed.data.responsibleQueueIds ?? []),
      ...(parsed.data.responsibleQueueId ? [parsed.data.responsibleQueueId] : []),
    ]);
    for (const schedule of schedules) {
      // Each queue has its own roster: the plantão only collides with another of the same queue.
      if (!receivingQueueIds.length) await assertNoScheduleConflict(db, { ...schedule, responsibleQueueId: null }, context.tenantId);
      for (const queueId of receivingQueueIds) await assertNoScheduleConflict(db, { ...schedule, responsibleQueueId: queueId }, context.tenantId);
    }
    const scheduleIds = schedules.map(() => randomUUID());
    const now = new Date();
    const typeId = await resolveDutyTypeId(db, context.tenantId, context.userId, parsed.data.typeName);
    await db.transaction(async (tx) => {
      await tx.insert(schema.unitDutySchedules).values(schedules.map((schedule, index) => ({
        id: scheduleIds[index],
        tenantId: context.tenantId,
        branchId: schedule.branchId,
        queueId: schedule.queueId,
        name: schedule.name,
        typeId,
        dayOfWeek: schedule.dayOfWeek,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        priority: 100,
        minimumBrokers: schedule.minimumBrokers,
        maximumBrokers: schedule.maximumBrokers,
        maxLeadsPerBroker: schedule.maxLeadsPerBroker,
        shiftSplitAt: schedule.shiftSplitAt,
        validFrom: schedule.validFrom,
        validUntil: schedule.validUntil ?? null,
        webhookCredentialId: schedule.webhookCredentialId ?? null,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      })));
      await tx.insert(schema.auditLogs).values(scheduleIds.map((scheduleId) => ({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: scheduleId, acao: "duty_schedule.created",
      })));
      if (receivingQueueIds.length) {
        for (const scheduleId of scheduleIds) await relinkScheduleQueues(tx, context, scheduleId, receivingQueueIds);
      }
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: scheduleIds[0], scheduleIds, message: `${scheduleIds.length} plantão(ões) criado(s) para todas as unidades.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o plantão." };
  }
}

export async function updateDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  const parsed = parseDutyScheduleInput(formData);
  if (!scheduleId.success || !parsed.success) return { error: "Revise os dados do plantão." };
  try {
    validateSchedule(parsed.data);
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") throw new Error("Restaure o plantão antes de editá-lo.");
    if (context.role === "manager") throw new Error("Apenas Diretores podem editar plantões globais.");
    const nextSplit = validShiftSplit(parsed.data, parsed.data.shiftSplitAt);
    if (parsed.data.shiftSplitAt && !nextSplit) throw new Error("A divisão em turnos precisa ficar entre o início e o fim do plantão.");
    // Optional: the queues that receive this plantão ([] = none). Absent = unchanged.
    // "receivingQueueId" (one queue) is still accepted from forms already open.
    const queuesField = formData.get("receivingQueueIds");
    const singleField = formData.get("receivingQueueId");
    const requestedQueueIds = queuesField !== null
      ? z.array(z.string().uuid()).max(30).parse(JSON.parse(String(queuesField) || "[]"))
      : singleField !== null
        ? [z.union([z.literal(""), z.string().uuid()]).parse(singleField)].filter(Boolean)
        : undefined;
    const receivingQueueIds = requestedQueueIds === undefined ? undefined : await activeQueueIds(db, context.tenantId, requestedQueueIds);
    if (receivingQueueIds?.length) {
      for (const queueId of receivingQueueIds) await assertNoScheduleConflict(db, { ...parsed.data, responsibleQueueId: queueId }, context.tenantId, schedule.id);
    } else {
      await assertNoScheduleConflict(db, parsed.data, context.tenantId, schedule.id);
    }
    const typeId = await resolveDutyTypeId(db, context.tenantId, context.userId, parsed.data.typeName);
    await db.transaction(async (tx) => {
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.tenantId}), hashtext(${`duty-capacity:${schedule.id}:${dayOfWeek}`}))`);
      }
      if (parsed.data.maximumBrokers != null) {
        const currentAssignments = await tx.select({ dayOfWeek: schema.dutyRosterAssignments.dayOfWeek })
          .from(schema.dutyRosterAssignments)
          .where(and(eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.scheduleId, schedule.id), eq(schema.dutyRosterAssignments.status, "active"), isNull(schema.dutyRosterAssignments.dutyDate)));
        const occupiedByDay = new Map<number, number>();
        for (const assignment of currentAssignments) occupiedByDay.set(assignment.dayOfWeek, (occupiedByDay.get(assignment.dayOfWeek) ?? 0) + 1);
        if ([...occupiedByDay.values()].some((occupied) => occupied > parsed.data.maximumBrokers!)) {
          throw new Error("O máximo não pode ficar abaixo da quantidade de corretores já escalados.");
        }
      }
      await tx.update(schema.unitDutySchedules).set({
        branchId: schedule.branchId,
        queueId: schedule.queueId,
        name: parsed.data.name,
        dayOfWeek: parsed.data.dayOfWeek,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        minimumBrokers: parsed.data.minimumBrokers,
        typeId,
        maximumBrokers: parsed.data.maximumBrokers ?? null,
        maxLeadsPerBroker: parsed.data.maxLeadsPerBroker ?? null,
        // Absent from the form = unchanged (older forms, "estender").
        ...(formData.has("shiftSplitAt") ? { shiftSplitAt: nextSplit } : {}),
        validFrom: parsed.data.validFrom,
        validUntil: parsed.data.validUntil ?? null,
        webhookCredentialId: parsed.data.webhookCredentialId ?? null,
        updatedAt: new Date(),
      }).where(and(eq(schema.unitDutySchedules.id, schedule.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)));
      // The weekly roster keeps a copy of the plantão's validity (distribution
      // and presence read it): it must follow the plantão, or a shortened
      // plantão keeps its brokers "on duty" in later weeks.
      await tx.update(schema.dutyRosterAssignments).set({
        validFrom: parsed.data.validFrom,
        validUntil: parsed.data.validUntil ?? null,
        updatedBy: context.userId,
        updatedAt: new Date(),
      }).where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        eq(schema.dutyRosterAssignments.scheduleId, schedule.id),
        eq(schema.dutyRosterAssignments.status, "active"),
        isNull(schema.dutyRosterAssignments.dutyDate),
      ));
      // The split moved (or was removed): morning brokers keep the morning,
      // afternoon brokers the afternoon, in their roster windows.
      if (formData.has("shiftSplitAt") && nextSplit !== (schedule.shiftSplitAt ?? null)) {
        const roster = await tx.select({ id: schema.dutyRosterAssignments.id, startsAt: schema.dutyRosterAssignments.startsAt, endsAt: schema.dutyRosterAssignments.endsAt })
          .from(schema.dutyRosterAssignments)
          .where(and(eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.scheduleId, schedule.id), eq(schema.dutyRosterAssignments.status, "active")));
        for (const assignment of roster) {
          const retimed = retimeAssignmentForSplit(parsed.data, schedule.shiftSplitAt ?? null, nextSplit, assignment);
          if (retimed) await tx.update(schema.dutyRosterAssignments).set({ ...retimed, updatedBy: context.userId, updatedAt: new Date() }).where(eq(schema.dutyRosterAssignments.id, assignment.id));
        }
      }
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id, acao: "duty_schedule.updated",
      });
      if (receivingQueueIds !== undefined) await relinkScheduleQueues(tx, context, schedule.id, receivingQueueIds);
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id, message: "Plantão atualizado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível editar o plantão." };
  }
}

export async function toggleDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") throw new Error("Restaure o plantão antes de ativá-lo.");
    const next = schedule.status === "active" ? "inactive" : "active";
    if (next === "active") {
      await assertNoScheduleConflict(db, schedule, context.tenantId, schedule.id);
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.unitDutySchedules).set({ status: next, updatedAt: new Date() })
        .where(and(eq(schema.unitDutySchedules.id, schedule.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id,
        acao: next === "active" ? "duty_schedule.activated" : "duty_schedule.deactivated",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar o plantão." };
  }
}

export async function duplicateDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") throw new Error("Não é possível duplicar um plantão arquivado.");
    const cloneId = randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(schema.unitDutySchedules).values({
        ...schedule,
        id: cloneId,
        name: `${schedule.name} (cópia)`,
        status: "inactive",
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: cloneId, acao: "duty_schedule.duplicated",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: cloneId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível duplicar o plantão." };
  }
}

export async function archiveDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") return { success: true, scheduleId: schedule.id };
    await db.transaction(async (tx) => {
      const now = new Date();
      await tx.update(schema.unitDutySchedules).set({ status: "archived", updatedAt: now })
        .where(and(eq(schema.unitDutySchedules.id, schedule.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)));
      await tx.update(schema.dutyRosterAssignments).set({ status: "inactive", updatedBy: context.userId, updatedAt: now })
        .where(and(eq(schema.dutyRosterAssignments.scheduleId, schedule.id), eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.status, "active")));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id, acao: "duty_schedule.archived",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível arquivar o plantão." };
  }
}

export async function deleteDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    await db.transaction(async (tx) => {
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "unit_duty_schedule",
        entidadeId: schedule.id,
        acao: "duty_schedule.deleted",
      });
      await tx.delete(schema.dutyRosterAssignments).where(and(
        eq(schema.dutyRosterAssignments.scheduleId, schedule.id),
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
      ));
      await tx.delete(schema.unitDutySchedules).where(and(
        eq(schema.unitDutySchedules.id, schedule.id),
        eq(schema.unitDutySchedules.tenantId, context.tenantId),
      ));
      // A permanently deleted plantão must stop being anyone's "fila
      // responsável" — otherwise the next save on that queue fails with
      // "Um dos plantões selecionados não pertence a esta corretora." for a
      // schedule the editor never shows as selected (it's gone from the
      // checklist, but the queue row still points at it).
      await tx.execute(sql`
        UPDATE ${schema.leadQueues}
        SET exclusive_duty_schedule_ids = COALESCE(${schema.leadQueues.exclusiveDutyScheduleIds}, '[]'::jsonb) - ${schedule.id}::text,
            exclusive_duty_schedule_id = CASE WHEN ${schema.leadQueues.exclusiveDutyScheduleId} = ${schedule.id} THEN NULL ELSE ${schema.leadQueues.exclusiveDutyScheduleId} END,
            updated_at = now()
        WHERE ${schema.leadQueues.tenantId} = ${context.tenantId}
          AND (
            ${schema.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([schedule.id])}::jsonb
            OR ${schema.leadQueues.exclusiveDutyScheduleId} = ${schedule.id}
          )
      `);
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id, message: "Plantão excluído permanentemente." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir o plantão." };
  }
}

export async function restoreDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status !== "archived") throw new Error("Este plantão não está arquivado.");
    await assertNoScheduleConflict(db, schedule, context.tenantId, schedule.id);
    await db.transaction(async (tx) => {
      await tx.update(schema.unitDutySchedules).set({ status: "inactive", updatedAt: new Date() })
        .where(and(eq(schema.unitDutySchedules.id, schedule.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id, acao: "duty_schedule.restored",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível restaurar o plantão." };
  }
}

/**
 * Manual "send/resend now" for one roster row's presence-confirmation
 * invite — the roster page's per-broker button, not a form. Reuses the same
 * director/manager + branch-scope check as every other roster mutation.
 */
export async function sendDutyPresenceInviteManuallyAction(scheduleId: string, assignmentId: string): Promise<ManualDutyPresenceInviteResult> {
  try {
    const { context } = await findScheduleForMutation(scheduleId);
    return await sendDutyPresenceInviteManually({ tenantId: context.tenantId, assignmentId, requestedBy: context.userId });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível enviar o convite." };
  }
}

/**
 * Pause/resume one escalado's live "próximo lead" countdown — stops
 * automatic distribution from offering them anything while paused, without
 * pulling them off the roster (they stay visible, badge shows "Pausado").
 * Scoped to this one plantão: pausing here does not touch any other
 * schedule the same broker may be escalado on.
 */
export async function toggleDutyRosterPauseAction(scheduleId: string, assignmentId: string, paused: boolean): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { context, db } = await findScheduleForMutation(scheduleId);
    const now = new Date();
    const updated = await db.update(schema.dutyRosterAssignments)
      .set({ pausedAt: paused ? now : null, pausedBy: paused ? context.userId : null, updatedBy: context.userId, updatedAt: now })
      .where(and(
        eq(schema.dutyRosterAssignments.id, assignmentId),
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        eq(schema.dutyRosterAssignments.scheduleId, scheduleId),
        eq(schema.dutyRosterAssignments.status, "active"),
      ))
      .returning({ id: schema.dutyRosterAssignments.id });
    if (!updated.length) return { success: false, error: "Escalação não encontrada." };
    await db.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "duty_roster_assignment", entidadeId: assignmentId,
      acao: paused ? "duty_roster.paused" : "duty_roster.resumed",
    });
    // Resuming frees this broker right now: leads already waiting must not
    // keep the retry time computed while they were paused.
    if (!paused) await wakeLeadsAwaitingEligibleBroker(context.tenantId).catch(() => 0);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar a pausa." };
  }
}
