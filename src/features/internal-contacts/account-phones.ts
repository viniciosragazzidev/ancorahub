import "server-only";

import { and, eq, isNull, or, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { internalPhoneKey, sameInternalPhone } from "./decision";

/** Números da própria conta: o oficial da Meta e o WhatsApp da empresa (WAHA). Mandar aviso para eles volta para a própria caixa. */
export async function getOwnAccountPhones(tenantId: string): Promise<string[]> {
  const db = getDatabase();
  const [channels, numbers] = await Promise.all([
    db.select({ phone: schema.communicationChannels.displayPhoneNumber }).from(schema.communicationChannels)
      .where(eq(schema.communicationChannels.tenantId, tenantId)),
    db.select({ phone: schema.wahaNumbers.displayPhoneNumber }).from(schema.wahaNumbers)
      .where(eq(schema.wahaNumbers.tenantId, tenantId)),
  ]);
  return [...channels, ...numbers].map((row) => row.phone).filter((phone): phone is string => Boolean(phone));
}

/** O primeiro telefone digitado que é da própria conta, ou null. */
export function findOwnAccountPhone(typed: readonly string[], own: readonly string[]) {
  return typed.find((phone) => own.some((item) => sameInternalPhone(item, phone))) ?? null;
}

/** Telefones digitados que hoje são de um lead da empresa, com o nome do lead. */
export async function findLeadPhones(tenantId: string, phones: readonly string[]): Promise<Array<{ phone: string; leadName: string }>> {
  const keyed = phones.map((phone) => ({ phone, key: internalPhoneKey(phone) })).filter((item): item is { phone: string; key: string } => Boolean(item.key));
  if (!keyed.length) return [];
  const conditions = keyed.map((item) => sql`regexp_replace(${schema.leads.telefone}, '[^0-9]', '', 'g') LIKE ${`%${item.key.slice(-8)}`}`);
  const rows = await getDatabase().select({ name: schema.leads.nome, phone: schema.leads.telefone }).from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt), or(...conditions)))
    .limit(500);
  const found: Array<{ phone: string; leadName: string }> = [];
  for (const item of keyed) {
    const lead = rows.find((row) => sameInternalPhone(row.phone, item.phone));
    if (lead) found.push({ phone: item.phone, leadName: lead.name || "Lead sem nome" });
  }
  return found;
}
