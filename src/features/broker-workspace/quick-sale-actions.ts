"use server";

import "server-only";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { quickSaleInputSchema, type QuickSaleResult } from "./quick-sale";
import { isBrokerQuickSaleEnabled } from "./quick-sale-flag";
import { listQuickSaleLeads } from "./quick-sale-queries";

/**
 * Lista do Registrar venda: leads em negociação do corretor da sessão, com busca por nome ou telefone e limite no
 * servidor. Tenant, papel e responsável vêm só da sessão. Leitura, sem auditoria.
 */
export async function listQuickSaleLeadsAction(raw: unknown): Promise<QuickSaleResult> {
  const parsed = quickSaleInputSchema.safeParse(raw ?? {});
  if (!parsed.success) return { ok: false, error: "Busca inválida. Use até 100 caracteres." };

  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return { ok: false, error: "Registrar venda é do corretor responsável pelo lead." };
  if (!(await isBrokerQuickSaleEnabled())) return { ok: false, error: "Registrar venda não está disponível no momento." };

  try {
    return { ok: true, leads: await listQuickSaleLeads(context, parsed.data.query) };
  } catch (error) {
    console.error("[registrar-venda] lista falhou", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "Não foi possível carregar seus leads agora." };
  }
}
