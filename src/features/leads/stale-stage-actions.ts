"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { changeLeadStatus } from "./change-lead-status";
import { STALE_RULE, staleStageModeKey } from "./stale-stage-rule";
import { runStaleStageForTenant } from "./stale-stage-sweep";

type Result = { ok: true; message: string } | { ok: false; reason: string };

async function directorContext() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Só o diretor liga a regra de chat parado.");
  return context;
}

/** Gera a lista agora (sem esperar o job das 9h): o que a regra faria hoje, sem mexer em nada. */
export async function refreshStaleStageSimulationAction(): Promise<Result> {
  try {
    const context = await directorContext();
    const result = await runStaleStageForTenant(context.tenantId, "simulate");
    revalidatePath("/leads");
    return { ok: true, message: `Simulação atualizada: ${"simulated" in result ? result.simulated : 0} leads mudariam de etapa.` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível gerar a simulação." };
  }
}

/** O diretor aprovou a simulação: liga a regra para a empresa e já aplica hoje. */
export async function applyStaleStageRuleAction(): Promise<Result> {
  try {
    const context = await directorContext();
    await setSystemSetting(staleStageModeKey(context.tenantId), "on");
    const result = await runStaleStageForTenant(context.tenantId, "on");
    revalidatePath("/leads");
    const applied = "applied" in result ? result.applied : 0;
    return { ok: true, message: `Regra ligada. ${applied} ${applied === 1 ? "lead mudou" : "leads mudaram"} de etapa agora; daqui em diante ela roda todo dia às 9h.` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível ligar a regra." };
  }
}

const keepInput = z.object({ leadId: z.string().min(1) });

/**
 * "Manter na etapa" (corretor do lead, gestor ou diretor): o lead em Aguardando retorno volta para a etapa em que
 * estava e a regra de chat parado não mexe nele por 7 dias.
 */
export async function keepLeadStageAction(raw: unknown): Promise<Result> {
  try {
    const { leadId } = keepInput.parse(raw);
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db.select({ status: schema.leads.status, stageBeforeAwaiting: schema.leads.stageBeforeAwaiting })
      .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
    if (!lead) return { ok: false, reason: "Lead não encontrado." };
    if (lead.status === "awaiting_reply") {
      // Mesmas regras de permissão de qualquer mudança de etapa (corretor do lead, gestão da unidade).
      await changeLeadStatus({ leadId, newStatus: lead.stageBeforeAwaiting ?? "in_contact" });
    }
    const holdUntil = new Date(Date.now() + STALE_RULE.holdDays * 24 * 60 * 60 * 1000);
    await db.update(schema.leads).set({ stageHoldUntil: holdUntil }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)));
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message: `Mantido na etapa. A regra de chat parado não mexe neste lead por ${STALE_RULE.holdDays} dias.` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível manter o lead na etapa." };
  }
}
