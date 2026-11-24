import "server-only";

import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

import { getDatabase } from "@/shared/db";

/**
 * DEC-191: a tabela `leads` vista só com o vínculo da lista de importação (migration 0236). Fica fora de
 * `schema.leads` de propósito: inserts e selects do resto do sistema continuam iguais antes e depois da migration.
 * Só o código das listas usa esta visão, e só depois de `isLeadListsReady()`.
 */
export const leadListLinks = pgTable("leads", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  importListId: text("import_list_id"),
});

const READY_TTL_MS = 60_000;
let readyCache: { value: boolean; at: number } | null = null;

/** A migration 0236 está aplicada? (tabela `supervisor_lead_lists` e coluna `leads.import_list_id`). Cache curto. */
export async function isLeadListsReady(now = Date.now()): Promise<boolean> {
  if (readyCache && now - readyCache.at < READY_TTL_MS) return readyCache.value;
  const value = await getDatabase()
    .execute(sql`select
      to_regclass('public.supervisor_lead_lists') is not null
      and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name = 'import_list_id')
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
export function resetLeadListsCache() {
  readyCache = null;
}
