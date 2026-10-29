"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { listInvitedBrokers, listPendingRosterEntries } from "./duty-roster-pending";

type Result = { success: true } | { success: false; error: string };

/** The plantão, if the viewer manages it (director; manager of its unit). */
async function scheduleInScope(scheduleId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") throw new Error("Sem permissão.");
  const [schedule] = await getDatabase()
    .select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId, status: schema.unitDutySchedules.status })
    .from(schema.unitDutySchedules)
    .where(and(eq(schema.unitDutySchedules.id, scheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .limit(1);
  if (!schedule) throw new Error("Plantão não encontrado.");
  if (context.role === "manager" && schedule.branchId && context.branchId !== schedule.branchId) throw new Error("Plantão fora do seu escopo.");
  return { context, schedule };
}

const ids = z.object({ scheduleId: z.string().uuid(), brokerProfileId: z.string().min(1).max(120) });

/** Puts an invited broker (no account yet) on the plantão; it becomes a real roster row once they accept the invite. */
export async function addPendingRosterEntryAction(input: { scheduleId: string; brokerProfileId: string }): Promise<Result> {
  try {
    const parsed = ids.safeParse(input);
    if (!parsed.success) return { success: false, error: "Seleção inválida." };
    const { context, schedule } = await scheduleInScope(parsed.data.scheduleId);
    if (schedule.status !== "active") return { success: false, error: "Plantão inativo." };
    const db = getDatabase();
    const [profile] = await db.select({ id: schema.brokerProfiles.id, branchId: schema.brokerProfiles.branchId })
      .from(schema.brokerProfiles)
      .where(and(
        eq(schema.brokerProfiles.id, parsed.data.brokerProfileId),
        eq(schema.brokerProfiles.tenantId, context.tenantId),
        isNull(schema.brokerProfiles.userId),
        inArray(schema.brokerProfiles.lifecycleStatus, ["INVITED", "ONBOARDING"]),
      ))
      .limit(1);
    if (!profile) return { success: false, error: "Corretor não encontrado entre os convidados (ou já criou a conta: escale pela lista normal)." };
    if (context.role === "manager" && profile.branchId !== context.branchId) return { success: false, error: "Corretor de outra unidade." };
    // A plantão of a unit only takes that unit's brokers (for everyone, director included).
    if (schedule.branchId && profile.branchId !== schedule.branchId) return { success: false, error: "O corretor é de outra unidade que a do plantão." };
    await db.insert(schema.dutyRosterPending).values({ id: randomUUID(), tenantId: context.tenantId, scheduleId: schedule.id, brokerProfileId: profile.id, createdBy: context.userId }).onConflictDoNothing();
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_roster_pending", entidadeId: profile.id, acao: "duty_roster_pending.created" });
    revalidatePath(`/leads/distribuicao/plantao/${schedule.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível escalar o corretor." };
  }
}

/** Takes an invited broker off the plantão. */
export async function removePendingRosterEntryAction(input: { scheduleId: string; entryId: string }): Promise<Result> {
  try {
    const parsed = z.object({ scheduleId: z.string().uuid(), entryId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Seleção inválida." };
    const { context, schedule } = await scheduleInScope(parsed.data.scheduleId);
    const db = getDatabase();
    await db.delete(schema.dutyRosterPending).where(and(eq(schema.dutyRosterPending.id, parsed.data.entryId), eq(schema.dutyRosterPending.scheduleId, schedule.id), eq(schema.dutyRosterPending.tenantId, context.tenantId)));
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_roster_pending", entidadeId: parsed.data.entryId, acao: "duty_roster_pending.removed" });
    revalidatePath(`/leads/distribuicao/plantao/${schedule.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível remover." };
  }
}

type PendingPerson = { id: string; name: string; internalCode: string | null; branchName: string | null };

/**
 * For the plantão drawer in Distribuição › Plantão (29/10): who is on it with "Convite pendente" and
 * the invited brokers (no account yet) the viewer may still put on it (a manager: only of their unit).
 */
export async function listPendingRosterForScheduleAction(input: { scheduleId: string }): Promise<
  { success: true; entries: Array<PendingPerson & { entryId: string }>; candidates: PendingPerson[] } | { success: false; error: string }
> {
  try {
    const parsed = z.object({ scheduleId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Plantão inválido." };
    const { context, schedule } = await scheduleInScope(parsed.data.scheduleId);
    const [entries, invited] = await Promise.all([
      listPendingRosterEntries(context.tenantId, schedule.id),
      listInvitedBrokers(context.tenantId, context.role === "manager" ? context.branchId ?? null : schedule.branchId ?? null),
    ]);
    return {
      success: true,
      entries: entries.map((entry) => ({ entryId: entry.id, id: entry.brokerProfileId, name: entry.name, internalCode: entry.internalCode, branchName: entry.branchName })),
      candidates: invited.filter((person) => !entries.some((entry) => entry.brokerProfileId === person.id)),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível carregar os convidados." };
  }
}
