"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { saveRecoverySettings } from "./settings";
import { parseRecoverySettings, type RecoverySettings } from "./settings-core";

/**
 * Salva a configuração da recuperação (só o diretor). Passa pelo mesmo parse da leitura: WAHA nunca vale em passo
 * de template e o controle fica entre 0 e 50%. Cada troca fica na auditoria.
 */
export async function saveRecoverySettingsAction(input: RecoverySettings): Promise<{ ok: true; settings: RecoverySettings } | { ok: false; error: string }> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só o diretor altera a recuperação." };
    const settings = parseRecoverySettings(JSON.stringify(input));
    await saveRecoverySettings(context.tenantId, settings);
    const flags = [settings.enabled ? "on" : "off", settings.stoppedMidway && "parou", settings.warmBridge && "morno", settings.callQueue && "fila", settings.scoring && "pontuacao", settings.nurture && "nutricao", settings.stepExperiments && "ab", settings.legalReviewedAt ? "juridico_ok" : "juridico_pendente", `controle_${settings.controlPct}`].filter(Boolean).join(":");
    await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_recovery", entidadeId: context.tenantId, acao: `settings_updated:${flags}`, createdAt: new Date() }).catch(() => undefined);
    revalidatePath("/qualificacao/turbo");
    revalidatePath("/qualificacao/recuperacao");
    return { ok: true, settings };
  } catch (error) {
    console.error("[lead-recovery] save_settings", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não deu para salvar a recuperação agora." };
  }
}

/**
 * "Mandar segurados frios para a fila" (fase 4, ação em lote): os frios segurados sem corretor e sem opt-out
 * entram na fila de ligação com a pontuação (até 300 por vez). Só marca: não liga nem manda mensagem.
 */
export async function moveHeldColdToCallQueueAction(): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só o diretor manda leads para a fila de ligação em lote." };
    const { moveHeldColdToCallQueue } = await import("./call-queue");
    const moved = await moveHeldColdToCallQueue(context.tenantId, context.userId);
    revalidatePath("/qualificacao/recuperacao");
    return { ok: true, moved };
  } catch (error) {
    console.error("[lead-recovery] move_held", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não deu para mandar para a fila agora. Os leads continuam como estavam." };
  }
}
