"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizePhone } from "@/features/leads/manual-create";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import {
  collectFieldErrors,
  priorClientSchema,
  priorContractSchema,
  type PriorContractActionResult,
  type PriorClientResult,
} from "./prior-portfolio-input";
import { findPriorPortfolioDuplicate, isBrokerPriorClientsEnabled, loadOwnPriorClient } from "./prior-portfolio";
import { portfolioClients } from "./prior-portfolio-schema";

/**
 * Cliente que já possuo (DEC-187). Tudo do tenant e do corretor da sessão; nada cria lead, venda, comissão,
 * conversão ou pontos. Cada mudança grava `audit_logs` com o ator e o tenant.
 */

const UNAVAILABLE = "Cliente que já possuo não está disponível no momento.";
const GENERIC = "Não foi possível salvar agora. Tente de novo.";

async function brokerContext() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return { error: "Esta ação é do corretor dono da carteira." } as const;
  if (!(await isBrokerPriorClientsEnabled())) return { error: UNAVAILABLE } as const;
  return { context } as const;
}

function audit(userId: string, tenantId: string, entidade: string, entidadeId: string, acao: string, metadata: Record<string, unknown> = {}) {
  return { id: randomUUID(), userId, entidade, entidadeId, acao, metadata: { tenantId, ...metadata } };
}

function logFailure(scope: string, error: unknown) {
  console.error(`[carteira-anterior] ${scope}`, error instanceof Error ? error.name : "unknown");
}

export async function createPriorClientAction(raw: unknown): Promise<PriorClientResult> {
  const parsed = priorClientSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: collectFieldErrors(parsed.error) };
  const access = await brokerContext();
  if ("error" in access) return { ok: false, error: access.error! };
  const { context } = access;
  const data = parsed.data;
  const telefone = normalizePhone(data.telefone);

  try {
    const db = getDatabase();
    if (!data.duplicateConfirmed) {
      const duplicate = await findPriorPortfolioDuplicate(context, telefone);
      if (duplicate) {
        // Só registra que houve bloqueio; nada do outro registro vai para a auditoria nem para a tela.
        await db.insert(schema.auditLogs).values(audit(context.userId, context.tenantId, "client", context.userId, "client.prior_portfolio.duplicate_blocked", { mine: duplicate.mine }));
        return { ok: false, duplicate };
      }
    }

    const clientId = randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(portfolioClients).values({
        id: clientId,
        tenantId: context.tenantId,
        leadId: null,
        branchId: context.branchId ?? null,
        corretorId: context.userId,
        nome: data.nome,
        telefone,
        email: data.email,
        convertedAt: now,
        source: "prior_portfolio",
        originNote: data.observacao,
        createdBy: context.userId,
      });
      await tx.insert(schema.auditLogs).values(audit(context.userId, context.tenantId, "client", clientId, "client.prior_portfolio.created", {
        contracts: data.contracts.length,
        duplicateConfirmed: Boolean(data.duplicateConfirmed),
      }));
      for (const contract of data.contracts) {
        const contractId = randomUUID();
        await tx.insert(schema.clientPriorContracts).values({
          id: contractId,
          tenantId: context.tenantId,
          clientId,
          brokerId: context.userId,
          branchId: context.branchId ?? null,
          ...contract,
          createdBy: context.userId,
          updatedBy: context.userId,
        });
        await tx.insert(schema.auditLogs).values(audit(context.userId, context.tenantId, "client_prior_contract", contractId, "client_prior_contract.created", { clientId }));
      }
    });
    revalidatePath("/clientes");
    return { ok: true, clientId };
  } catch (error) {
    logFailure("cadastro", error);
    return { ok: false, error: GENERIC };
  }
}

const updateClientSchema = z.object({
  clientId: z.string().uuid(),
  nome: priorClientSchema.shape.nome,
  email: priorClientSchema.shape.email,
  observacao: priorClientSchema.shape.observacao,
});

export async function updatePriorClientAction(raw: unknown): Promise<PriorContractActionResult> {
  const parsed = updateClientSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: collectFieldErrors(parsed.error) };
  const access = await brokerContext();
  if ("error" in access) return { ok: false, error: access.error! };
  const { context } = access;
  try {
    const client = await loadOwnPriorClient(context, parsed.data.clientId);
    if (!client) return { ok: false, error: "Cliente não encontrado na sua carteira." };
    const db = getDatabase();
    await db.transaction(async (tx) => {
      await tx.update(portfolioClients)
        .set({ nome: parsed.data.nome, email: parsed.data.email, originNote: parsed.data.observacao })
        .where(and(eq(portfolioClients.id, client.id), eq(portfolioClients.tenantId, context.tenantId), eq(portfolioClients.corretorId, context.userId), eq(portfolioClients.source, "prior_portfolio")));
      await tx.insert(schema.auditLogs).values(audit(context.userId, context.tenantId, "client", client.id, "client.prior_portfolio.updated", {
        changed: ["nome", "email", "observacao"].filter((field) => {
          const before = field === "nome" ? client.name : field === "email" ? client.email : client.originNote;
          const after = field === "nome" ? parsed.data.nome : field === "email" ? parsed.data.email : parsed.data.observacao;
          return (before ?? null) !== (after ?? null);
        }),
      }));
    });
    revalidatePath(`/clientes/${client.id}`);
    revalidatePath("/clientes");
    return { ok: true };
  } catch (error) {
    logFailure("edição do cliente", error);
    return { ok: false, error: GENERIC };
  }
}

const saveContractSchema = z.object({
  clientId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  contract: priorContractSchema,
});

export async function savePriorContractAction(raw: unknown): Promise<PriorContractActionResult> {
  const parsed = saveContractSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: collectFieldErrors(parsed.error) };
  const access = await brokerContext();
  if ("error" in access) return { ok: false, error: access.error! };
  const { context } = access;
  try {
    const client = await loadOwnPriorClient(context, parsed.data.clientId);
    if (!client) return { ok: false, error: "Cliente não encontrado na sua carteira." };
    const db = getDatabase();
    const contractId = parsed.data.contractId ?? randomUUID();
    let found = true;
    await db.transaction(async (tx) => {
      if (parsed.data.contractId) {
        const updated = await tx.update(schema.clientPriorContracts)
          .set({ ...parsed.data.contract, updatedBy: context.userId, updatedAt: new Date() })
          .where(and(
            eq(schema.clientPriorContracts.id, contractId),
            eq(schema.clientPriorContracts.clientId, client.id),
            eq(schema.clientPriorContracts.tenantId, context.tenantId),
            eq(schema.clientPriorContracts.brokerId, context.userId),
          ))
          .returning({ id: schema.clientPriorContracts.id });
        if (!updated.length) { found = false; return; }
        await tx.insert(schema.auditLogs).values(audit(context.userId, context.tenantId, "client_prior_contract", contractId, "client_prior_contract.updated", { clientId: client.id }));
        return;
      }
      await tx.insert(schema.clientPriorContracts).values({
        id: contractId,
        tenantId: context.tenantId,
        clientId: client.id,
        brokerId: context.userId,
        branchId: client.branchId,
        ...parsed.data.contract,
        createdBy: context.userId,
        updatedBy: context.userId,
      });
      await tx.insert(schema.auditLogs).values(audit(context.userId, context.tenantId, "client_prior_contract", contractId, "client_prior_contract.created", { clientId: client.id }));
    });
    if (!found) return { ok: false, error: "Contrato não encontrado." };
    revalidatePath(`/clientes/${client.id}`);
    revalidatePath("/clientes");
    return { ok: true, contractId };
  } catch (error) {
    logFailure("contrato", error);
    return { ok: false, error: GENERIC };
  }
}

export async function removePriorContractAction(raw: unknown): Promise<PriorContractActionResult> {
  const parsed = z.object({ clientId: z.string().uuid(), contractId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Contrato inválido." };
  const access = await brokerContext();
  if ("error" in access) return { ok: false, error: access.error! };
  const { context } = access;
  try {
    const client = await loadOwnPriorClient(context, parsed.data.clientId);
    if (!client) return { ok: false, error: "Cliente não encontrado na sua carteira." };
    let removed = 0;
    await getDatabase().transaction(async (tx) => {
      const rows = await tx.delete(schema.clientPriorContracts)
        .where(and(
          eq(schema.clientPriorContracts.id, parsed.data.contractId),
          eq(schema.clientPriorContracts.clientId, client.id),
          eq(schema.clientPriorContracts.tenantId, context.tenantId),
          eq(schema.clientPriorContracts.brokerId, context.userId),
        ))
        .returning({ id: schema.clientPriorContracts.id });
      removed = rows.length;
      if (removed) await tx.insert(schema.auditLogs).values(audit(context.userId, context.tenantId, "client_prior_contract", parsed.data.contractId, "client_prior_contract.removed", { clientId: client.id }));
    });
    if (!removed) return { ok: false, error: "Contrato não encontrado." };
    revalidatePath(`/clientes/${client.id}`);
    revalidatePath("/clientes");
    return { ok: true };
  } catch (error) {
    logFailure("remoção de contrato", error);
    return { ok: false, error: GENERIC };
  }
}
