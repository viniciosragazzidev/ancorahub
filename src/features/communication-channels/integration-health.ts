import "server-only";

import { and, eq, gte, isNull, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { classifyIntegrationHealth, type IntegrationHealth, type IntegrationKey } from "./integration-health-core";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Canal pelo jeito que o lead entrou: WhatsApp (número próprio ou anúncio que abre o WhatsApp), formulários Meta, formulários do site. */
const keySql = sql<IntegrationKey | null>`case
  when ${schema.leads.sourceChannel} in ('whatsapp', 'whatsapp_ctwa')
    or (${schema.leads.sourceChannel} = 'meta_lead_ads' and ${schema.leads.sourceMetadata}->>'entry' = 'whatsapp') then 'whatsapp'
  when ${schema.leads.sourceChannel} in ('meta_lead_ads', 'meta_ads') then 'meta'
  when ${schema.leads.sourceChannel} = 'landing_page' and ${schema.leads.origem} <> 'manual' then 'forms'
  else null end`;

/**
 * Saúde das integrações (20/11/2026, ref P17): último lead recebido por canal e quantos nas últimas 24 h, nos
 * últimos 30 dias. Uma consulta agregada; quem abre a tela vê na hora se cada canal está recebendo.
 */
export async function getIntegrationHealth(context: TenantContext, now = new Date()): Promise<Record<IntegrationKey, IntegrationHealth>> {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const rows = await getDatabase()
    .select({
      key: keySql,
      last: sql<Date | null>`max(${schema.leads.createdAt})`,
      lastDay: sql<number>`(count(*) filter (where ${schema.leads.createdAt} >= ${dayAgo.toISOString()}::timestamptz))::int`,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), gte(schema.leads.createdAt, since)))
    .groupBy(keySql);
  const byKey = new Map(rows.filter((row) => row.key).map((row) => [row.key as IntegrationKey, row]));
  const build = (key: IntegrationKey) => {
    const row = byKey.get(key);
    return classifyIntegrationHealth(row?.last ? new Date(row.last) : null, Number(row?.lastDay ?? 0), now);
  };
  return { meta: build("meta"), whatsapp: build("whatsapp"), forms: build("forms") };
}
