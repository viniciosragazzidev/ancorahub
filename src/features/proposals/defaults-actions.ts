"use server";

import { randomUUID } from "node:crypto";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { MAX_PROPOSAL_CONDITIONS_LENGTH, MAX_PROPOSAL_VALID_DAYS, MIN_PROPOSAL_VALID_DAYS, parseProposalValidDays, proposalDefaultsKeys } from "./proposal-rules";

export type ProposalDefaultsActionState = { success: boolean; error?: string };

/** Só o diretor muda a validade e as condições padrão da corretora. */
export async function updateProposalDefaultsAction(_prev: ProposalDefaultsActionState, formData: FormData): Promise<ProposalDefaultsActionState> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Só o diretor altera os padrões de proposta." };

    const validDays = parseProposalValidDays(formData.get("validDays"));
    if (validDays === null) return { success: false, error: `Informe uma validade entre ${MIN_PROPOSAL_VALID_DAYS} e ${MAX_PROPOSAL_VALID_DAYS} dias.` };
    const conditions = String(formData.get("conditions") ?? "").trim();
    if (conditions.length > MAX_PROPOSAL_CONDITIONS_LENGTH) return { success: false, error: `As condições podem ter até ${MAX_PROPOSAL_CONDITIONS_LENGTH.toLocaleString("pt-BR")} caracteres.` };

    const keys = proposalDefaultsKeys(context.tenantId);
    const now = new Date();
    await setSystemSetting(keys.validDays, String(validDays), now);
    await setSystemSetting(keys.conditions, conditions, now);
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "tenant", entidadeId: context.tenantId, acao: "atualizou_padroes_proposta",
    });
    return { success: true };
  } catch {
    return { success: false, error: "Não deu para salvar os padrões de proposta agora." };
  }
}
