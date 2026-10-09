"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

/**
 * Plantão types (DEC-138): the group of a plantão (PME, Premium, Presencial),
 * with its modality, color, the units that take part and default hours.
 */
const time = z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido.");
const typeInput = z.object({
  name: z.string().trim().min(2, "O nome precisa de ao menos 2 letras.").max(60).transform((value) => value.replace(/\s+/g, " ")),
  attendanceMode: z.enum(["online", "presencial"]),
  colorHue: z.coerce.number().int().min(0).max(359).nullable().optional(),
  /** Empty = every unit. */
  branchIds: z.array(z.string().uuid()).max(100).default([]),
  defaultStartsAt: time.default("09:00"),
  defaultEndsAt: time.default("19:00"),
  defaultMinimumBrokers: z.coerce.number().int().min(1).max(99).default(1),
  defaultMaximumBrokers: z.coerce.number().int().min(1).max(99).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.defaultEndsAt <= value.defaultStartsAt) ctx.addIssue({ code: "custom", path: ["defaultEndsAt"], message: "O fim precisa ser depois do início." });
  if (value.defaultMaximumBrokers != null && value.defaultMaximumBrokers < value.defaultMinimumBrokers) ctx.addIssue({ code: "custom", path: ["defaultMaximumBrokers"], message: "O máximo deve ser igual ou maior que o mínimo." });
});

export type DutyTypeInput = z.input<typeof typeInput>;
export type DutyTypeResult = { ok: true; typeId: string } | { ok: false; error: string };

async function directorScope() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas Diretores podem configurar tipos de plantão.");
  return { context, db: getDatabase() };
}

async function assertBranches(db: ReturnType<typeof getDatabase>, tenantId: string, branchIds: readonly string[]) {
  if (!branchIds.length) return;
  const found = await db.select({ id: schema.branches.id }).from(schema.branches)
    .where(and(eq(schema.branches.tenantId, tenantId), inArray(schema.branches.id, [...new Set(branchIds)])));
  if (found.length !== new Set(branchIds).size) throw new Error("Unidade não encontrada.");
}

async function assertUniqueName(db: ReturnType<typeof getDatabase>, tenantId: string, name: string, exceptId?: string) {
  const [clash] = await db.select({ id: schema.dutyScheduleTypes.id }).from(schema.dutyScheduleTypes)
    .where(and(
      eq(schema.dutyScheduleTypes.tenantId, tenantId),
      sql`lower(${schema.dutyScheduleTypes.name}) = lower(${name})`,
      exceptId ? ne(schema.dutyScheduleTypes.id, exceptId) : undefined,
    )).limit(1);
  if (clash) throw new Error("Já existe um tipo de plantão com esse nome.");
}

function fail(error: unknown, fallback: string): DutyTypeResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? fallback };
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

export async function createDutyTypeAction(raw: DutyTypeInput): Promise<DutyTypeResult> {
  try {
    const input = typeInput.parse(raw);
    const { context, db } = await directorScope();
    await assertBranches(db, context.tenantId, input.branchIds);
    await assertUniqueName(db, context.tenantId, input.name);
    const id = randomUUID();
    await db.insert(schema.dutyScheduleTypes).values({
      id,
      tenantId: context.tenantId,
      name: input.name,
      attendanceMode: input.attendanceMode,
      colorHue: input.colorHue ?? null,
      branchIds: [...new Set(input.branchIds)],
      defaultStartsAt: input.defaultStartsAt,
      defaultEndsAt: input.defaultEndsAt,
      defaultMinimumBrokers: input.defaultMinimumBrokers,
      defaultMaximumBrokers: input.defaultMaximumBrokers ?? null,
      createdBy: context.userId,
      updatedBy: context.userId,
    });
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_schedule_type", entidadeId: id, acao: "duty_schedule_type.created" });
    return { ok: true, typeId: id };
  } catch (error) {
    return fail(error, "Não foi possível criar o tipo de plantão.");
  }
}

/** Editing a type never changes plantões already created: each keeps its own hours and modality. */
export async function updateDutyTypeAction(typeId: string, raw: DutyTypeInput): Promise<DutyTypeResult> {
  try {
    const id = z.string().uuid().parse(typeId);
    const input = typeInput.parse(raw);
    const { context, db } = await directorScope();
    await assertBranches(db, context.tenantId, input.branchIds);
    await assertUniqueName(db, context.tenantId, input.name, id);
    const [updated] = await db.update(schema.dutyScheduleTypes).set({
      name: input.name,
      attendanceMode: input.attendanceMode,
      colorHue: input.colorHue ?? null,
      branchIds: [...new Set(input.branchIds)],
      defaultStartsAt: input.defaultStartsAt,
      defaultEndsAt: input.defaultEndsAt,
      defaultMinimumBrokers: input.defaultMinimumBrokers,
      defaultMaximumBrokers: input.defaultMaximumBrokers ?? null,
      updatedBy: context.userId,
      updatedAt: new Date(),
    }).where(and(eq(schema.dutyScheduleTypes.id, id), eq(schema.dutyScheduleTypes.tenantId, context.tenantId)))
      .returning({ id: schema.dutyScheduleTypes.id });
    if (!updated) throw new Error("Tipo de plantão não encontrado.");
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_schedule_type", entidadeId: id, acao: "duty_schedule_type.updated" });
    return { ok: true, typeId: id };
  } catch (error) {
    return fail(error, "Não foi possível salvar o tipo de plantão.");
  }
}

/** Archived types stop showing for new plantões; existing plantões keep theirs. */
export async function setDutyTypeArchivedAction(typeId: string, archived: boolean): Promise<DutyTypeResult> {
  try {
    const id = z.string().uuid().parse(typeId);
    const { context, db } = await directorScope();
    const [updated] = await db.update(schema.dutyScheduleTypes).set({ status: archived ? "archived" : "active", updatedBy: context.userId, updatedAt: new Date() })
      .where(and(eq(schema.dutyScheduleTypes.id, id), eq(schema.dutyScheduleTypes.tenantId, context.tenantId)))
      .returning({ id: schema.dutyScheduleTypes.id });
    if (!updated) throw new Error("Tipo de plantão não encontrado.");
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_schedule_type", entidadeId: id, acao: archived ? "duty_schedule_type.archived" : "duty_schedule_type.restored" });
    return { ok: true, typeId: id };
  } catch (error) {
    return fail(error, "Não foi possível arquivar o tipo de plantão.");
  }
}
