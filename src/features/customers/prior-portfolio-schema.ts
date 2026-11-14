import "server-only";

import { sql } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { getDatabase, schema } from "@/shared/db";

/**
 * DEC-187: a tabela `clients` vista com as colunas da migration 0231 (`lead_id` anulável, `source`, `origin_note`,
 * `created_by`). Fica fora de `schema.ts` de propósito: o objeto canônico `schema.clients` continua sem essas
 * colunas, então inserts e selects do resto do sistema funcionam antes e depois da migration. Só o código da
 * carteira anterior usa esta visão, e só depois de `isPriorPortfolioSchemaReady()`.
 */
export const portfolioClients = pgTable("clients", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  leadId: text("lead_id"),
  branchId: text("branch_id"),
  corretorId: text("corretor_id"),
  nome: text("nome").notNull(),
  telefone: text("telefone").notNull(),
  email: text("email"),
  convertedAt: timestamp("converted_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source", { enum: ["sale", "prior_portfolio"] }).notNull().default("sale"),
  originNote: text("origin_note"),
  createdBy: text("created_by"),
});

/** Cliente de venda: com a CHECK da 0231, `lead_id` preenchido equivale a `source = 'sale'` (vale também antes dela). */
export function saleClientsOnly(table: { leadId: typeof schema.clients.leadId } = schema.clients) {
  return sql`${table.leadId} is not null`;
}

const READY_TTL_MS = 60_000;
let readyCache: { value: boolean; at: number } | null = null;

/** A migration 0231 está aplicada? (coluna `clients.source` e tabela `client_prior_contracts`). Cache curto. */
export async function isPriorPortfolioSchemaReady(now = Date.now()): Promise<boolean> {
  if (readyCache && now - readyCache.at < READY_TTL_MS) return readyCache.value;
  const value = await getDatabase()
    .execute(sql`select
      to_regclass('public.client_prior_contracts') is not null
      and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'source')
      as ready`)
    .then((result) => {
      const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as { ready?: boolean }[];
      return Boolean(rows[0]?.ready);
    })
    .catch(() => false);
  readyCache = { value, at: now };
  return value;
}

/** Só para testes. */
export function resetPriorPortfolioSchemaCache() {
  readyCache = null;
}
