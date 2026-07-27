"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getExternalQuoteBaseUrl } from "./external-quote-config";

export async function prepareExternalQuoteAction(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db
    .select({ id: schema.leads.id, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);

  if (!lead) return { success: false as const, error: "Lead não encontrado." };
  if (context.role === "broker" && lead.corretorId !== context.userId) {
    return { success: false as const, error: "Você só pode cotar seus próprios leads." };
  }
  if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) {
    return { success: false as const, error: "Este lead não pertence à sua filial." };
  }

  const baseUrl = getExternalQuoteBaseUrl();
  if (!baseUrl) {
    return { success: false as const, error: "O cotador externo ainda não foi configurado pela administração." };
  }

  baseUrl.searchParams.set("leadId", lead.id);
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "external_quote",
    entidadeId: lead.id,
    acao: "external_quote.opened",
  });

  return { success: true as const, url: baseUrl.toString() };
}
