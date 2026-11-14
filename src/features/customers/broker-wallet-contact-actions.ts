"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createLeadInteraction } from "@/features/leads/actions";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import { createManualLead } from "@/features/leads/manual-create";
import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { isBrokerMyWalletEnabled } from "./broker-my-wallet-flag";
import {
  describeBrokerWalletDuplicate,
  parseBrokerWalletContactInput,
  toManualLeadInput,
  type BrokerWalletContactResult,
} from "./broker-wallet-contact";

/**
 * Novo interessado pela Minha carteira. Reaproveita o cadastro manual (`criar_lead_manual`, corretor vira
 * responsável, auditoria "criou"), sem mudar distribuição, funil, conversão ou pontos. Tenant, filial, origem e
 * responsável vêm da sessão e do servidor.
 */
export async function createBrokerWalletContactAction(raw: unknown): Promise<BrokerWalletContactResult> {
  const parsed = parseBrokerWalletContactInput(raw);
  if (!parsed.ok) return parsed;

  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return { ok: false, error: "Esta ação é do corretor dono da carteira." };
  if (!(await isBrokerMyWalletEnabled())) return { ok: false, error: "Adicionar contato não está disponível no momento." };

  let result: Awaited<ReturnType<typeof createManualLead>>;
  try {
    result = await createManualLead(toManualLeadInput(parsed.data));
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Revise os dados do contato." };
    if (error instanceof AuthorizationError) return { ok: false, error: "Seu acesso não permite cadastrar contatos." };
    console.error("[minha-carteira] cadastro falhou", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "Não foi possível cadastrar agora. Tente de novo." };
  }

  const db = getDatabase();
  if (result.duplicate) {
    const [own] = await db.select({ id: schema.leads.id, name: schema.leads.nome })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, result.duplicate.id), buildLeadScopeWhere(context), isNull(schema.leads.deletedAt)))
      .limit(1);
    return describeBrokerWalletDuplicate(own ?? null);
  }

  const leadId = result.leadId;
  let noteSaved = false;
  try {
    if (parsed.data.observacao) {
      // O lead acabou de nascer com este corretor como responsável: a nota fica no histórico dele.
      await createLeadInteraction(db, { leadId, userId: context.userId, tipo: "note", conteudo: parsed.data.observacao });
      noteSaved = true;
    }
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: leadId,
      acao: "cadastro_minha_carteira",
      metadata: { tenantId: context.tenantId, origem: "manual", observacao: noteSaved, duplicadoConfirmado: Boolean(parsed.data.duplicateConfirmed) },
    });
  } catch (error) {
    // O lead já existe: a falha da nota não pode esconder o cadastro.
    console.error("[minha-carteira] nota/auditoria falhou", error instanceof Error ? error.name : "unknown");
  }

  revalidatePath("/clientes");
  return { ok: true, leadId, noteSaved };
}
