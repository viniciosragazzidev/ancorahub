"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { readColdAgeRelease, writeColdAgeRelease, type ColdAgeReleaseConfig } from "./cold-age-release";
import { todayKeyInSaoPaulo } from "./cold-age-release-rules";
import { wakeLeadsAwaitingEligibleBroker } from "./jobs";

type Result = { success: true; message: string; config: ColdAgeReleaseConfig } | { success: false; error: string };

async function loadQueue(queueId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Só o diretor altera a liberação dos leads frios.");
  const [queue] = await getDatabase().select({ id: schema.leadQueues.id, name: schema.leadQueues.name })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.id, z.string().min(1).parse(queueId)), eq(schema.leadQueues.tenantId, context.tenantId)))
    .limit(1);
  if (!queue) throw new Error("Fila não encontrada.");
  return { context, queue };
}

function failure(error: unknown): Result {
  return { success: false, error: error instanceof Error && error.message.length < 120 ? error.message : "Não foi possível salvar agora." };
}

export async function getColdAgeReleaseAction(queueId: string) {
  const { queue } = await loadQueue(queueId);
  return readColdAgeRelease(queue.id, queue.name);
}

/** Turns the 2-day rule on or off for this queue. */
export async function setColdAgeReleaseAction(queueId: string, enabled: boolean): Promise<Result> {
  try {
    const { context, queue } = await loadQueue(queueId);
    const current = await readColdAgeRelease(queue.id, queue.name);
    const config = { ...current, enabled };
    await writeColdAgeRelease(queue.id, config);
    // Turned off: everything held goes out now.
    if (!enabled) await wakeLeadsAwaitingEligibleBroker(context.tenantId).catch(() => 0);
    revalidatePath("/leads/distribuicao");
    return { success: true, message: enabled ? "Leads frios só saem com 2 dias, às 9h." : "Regra dos 2 dias desligada.", config };
  } catch (error) {
    return failure(error);
  }
}

/** "Liberar agora": today's release (leads of 2 days or more) without waiting for 9h. */
export async function releaseColdLeadsNowAction(queueId: string): Promise<Result> {
  try {
    const { context, queue } = await loadQueue(queueId);
    const current = await readColdAgeRelease(queue.id, queue.name);
    const config = { ...current, releasedEarlyOn: todayKeyInSaoPaulo(new Date()) };
    await writeColdAgeRelease(queue.id, config);
    const woken = await wakeLeadsAwaitingEligibleBroker(context.tenantId).catch(() => 0);
    revalidatePath("/leads/distribuicao");
    return { success: true, message: woken ? `Liberação de hoje antecipada: ${woken} lead(s) voltaram para a distribuição.` : "Liberação de hoje antecipada.", config };
  } catch (error) {
    return failure(error);
  }
}
