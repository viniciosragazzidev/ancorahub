import "server-only";

import { and, desc, eq, inArray, max, ne, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { describeWebhookDelivery, type WebhookDeliveryView } from "../utils/webhook-delivery-view";

export const WEBHOOK_DELIVERIES_LIMIT = 50;

type DeliveryScopeContext = Pick<TenantContext, "tenantId" | "role" | "branchId">;

/**
 * Escopo das entregas de uma fonte: sempre a empresa da sessão. Quem tem unidade (gestor com acesso à tela) só vê
 * as fontes daquela unidade; diretor e marketing central, sem unidade, veem a empresa toda.
 */
export function buildWebhookDeliveryScope(context: DeliveryScopeContext, credentialId: string, onlyProblems = false): SQL {
  const conditions: SQL[] = [
    eq(schema.webhookDeliveries.tenantId, context.tenantId),
    eq(schema.webhookDeliveries.credentialId, credentialId),
    eq(schema.leadWebhookCredentials.tenantId, context.tenantId),
  ];
  if (context.role !== "director" && context.branchId) conditions.push(eq(schema.leadWebhookCredentials.branchId, context.branchId));
  if (onlyProblems) conditions.push(ne(schema.webhookDeliveries.status, "processed"));
  return and(...conditions)!;
}

export type WebhookDeliveryItem = WebhookDeliveryView & { id: string; receivedAt: Date };

/** Últimas 50 entregas da fonte, mais recentes primeiro, já traduzidas para a tela. */
export async function listWebhookDeliveries(
  context: DeliveryScopeContext,
  credentialId: string,
  options: { onlyProblems?: boolean; now?: Date } = {},
): Promise<WebhookDeliveryItem[]> {
  const rows = await getDatabase()
    .select({
      id: schema.webhookDeliveries.id,
      status: schema.webhookDeliveries.status,
      errorCode: schema.webhookDeliveries.errorCode,
      leadId: schema.webhookDeliveries.leadId,
      receivedAt: schema.webhookDeliveries.receivedAt,
      leadCreatedAt: schema.leads.createdAt,
    })
    .from(schema.webhookDeliveries)
    .innerJoin(schema.leadWebhookCredentials, eq(schema.webhookDeliveries.credentialId, schema.leadWebhookCredentials.id))
    .leftJoin(schema.leads, and(eq(schema.webhookDeliveries.leadId, schema.leads.id), eq(schema.leads.tenantId, context.tenantId)))
    .where(buildWebhookDeliveryScope(context, credentialId, options.onlyProblems))
    .orderBy(desc(schema.webhookDeliveries.receivedAt))
    .limit(WEBHOOK_DELIVERIES_LIMIT);
  const now = options.now ?? new Date();
  return rows.map((row) => {
    // Lead de outra empresa (não deveria existir) nunca vira link.
    const view = describeWebhookDelivery(row, now);
    return { id: row.id, receivedAt: row.receivedAt, ...view, leadId: row.leadCreatedAt ? view.leadId : null };
  });
}

/** Último recebimento de cada fonte da empresa, em uma consulta só. */
export async function getLastReceivedByCredential(tenantId: string, credentialIds: string[]): Promise<Map<string, Date>> {
  if (!credentialIds.length) return new Map();
  const rows = await getDatabase()
    .select({ credentialId: schema.webhookDeliveries.credentialId, lastReceivedAt: max(schema.webhookDeliveries.receivedAt) })
    .from(schema.webhookDeliveries)
    .where(and(eq(schema.webhookDeliveries.tenantId, tenantId), inArray(schema.webhookDeliveries.credentialId, credentialIds)))
    .groupBy(schema.webhookDeliveries.credentialId);
  return new Map(rows.flatMap((row) => (row.lastReceivedAt ? [[row.credentialId, new Date(row.lastReceivedAt)] as const] : [])));
}
