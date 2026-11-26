import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "@/shared/db";

const READY_TTL_MS = 60_000;
let cache: { value: { versions: boolean; playbooks: boolean }; at: number } | null = null;

/**
 * A migration 0241 está aplicada? Confere as duas tabelas com to_regclass (cache de 1 minuto). Sem elas, salvar
 * grava por cima como antes e os playbooks seguem dentro de custom_instructions.
 */
export async function aiConfigTablesReady(now = Date.now()): Promise<{ versions: boolean; playbooks: boolean }> {
  if (cache && now - cache.at < READY_TTL_MS) return cache.value;
  const value = await getDatabase()
    .execute(sql`select to_regclass('public.ai_qualification_config_versions') is not null as versions, to_regclass('public.ai_qualification_playbooks') is not null as playbooks`)
    .then((result) => {
      const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as { versions?: boolean; playbooks?: boolean }[];
      return { versions: Boolean(rows[0]?.versions), playbooks: Boolean(rows[0]?.playbooks) };
    })
    .catch(() => ({ versions: false, playbooks: false }));
  cache = { value, at: now };
  return value;
}
