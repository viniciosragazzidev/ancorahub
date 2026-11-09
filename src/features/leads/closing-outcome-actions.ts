"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { CLOSING_STAGE_STATUSES } from "./closing-stage-notice-core";
import { parseClosingHoldDate } from "./closing-outcome-core";

type Result = { ok: true; message: string } | { ok: false; reason: string };

const holdInput = z.object({ leadId: z.string().min(1), expectedDate: z.string().min(1) });

/**
 * "Continua em análise" (desfecho do fechamento, 09/11): o corretor do lead (ou a gestão da unidade, ou o diretor)
 * informa a data prevista. O lead sai de "desfecho pendente" até essa data, fica registrado na linha do tempo e a
 * etapa não muda. A data mora em `stage_hold_until` (a regra de chat parado não olha o fechamento).
 */
export async function holdClosingOutcomeAction(raw: unknown): Promise<Result> {
  try {
    const { leadId, expectedDate } = holdInput.parse(raw);
    const context = await getRequiredTenantContext();
    const now = new Date();
    const parsed = parseClosingHoldDate(expectedDate, now);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    const db = getDatabase();
    const [lead] = await db
      .select({ status: schema.leads.status, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
      .limit(1);
    if (!lead) return { ok: false, reason: "Lead não encontrado." };
    const allowed = lead.corretorId === context.userId
      || context.role === "director"
      || (context.role === "manager" && Boolean(lead.branchId) && lead.branchId === context.branchId);
    if (!allowed) return { ok: false, reason: "Só o corretor do lead ou a gestão podem informar a data prevista." };
    if (!CLOSING_STAGE_STATUSES.has(lead.status)) return { ok: false, reason: "Este lead não está mais no fechamento." };

    const label = parsed.until.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    await db.transaction(async (tx) => {
      await tx.update(schema.leads).set({ stageHoldUntil: parsed.until })
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)));
      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId,
        userId: context.userId,
        tipo: "note",
        conteudo: `Continua em análise. Previsão de desfecho: ${label}.`,
        metadata: { source: "closing_outcome_hold", until: parsed.until.toISOString() },
        createdAt: now,
      });
    });
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message: `Anotado. Voltamos a perguntar depois de ${label}.` };
  } catch (error) {
    console.error("[closing-outcome] hold_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { ok: false, reason: "Não deu para salvar a data agora. Tente de novo em instantes." };
  }
}
