import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { AUTO_RULE_KEYS, parseAutoRuleRow, type AutoRuleKey, type AutoRuleSettings, type AutoRuleSettingsInput } from "./auto-rules";

export type AutoRulesState = { ready: boolean; rules: AutoRuleSettings[] };

/** Postgres "undefined_table": a migration 0224 ainda não rodou. */
function isMissingTable(error: unknown) {
  const code = error && typeof error === "object" ? (error as { code?: unknown; cause?: { code?: unknown } }).code ?? (error as { cause?: { code?: unknown } }).cause?.code : undefined;
  if (code === "42P01") return true;
  const message = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}` : "";
  return /post_sale_rules/.test(message) && /does not exist|não existe/i.test(message);
}

/**
 * As 5 regras da empresa. Sem a tabela (SQL ainda não aplicado) ou com erro de leitura, todas
 * desligadas: a página nunca quebra e o motor não envia.
 */
export async function loadAutoRules(tenantId: string): Promise<AutoRulesState> {
  try {
    const rows = await getDatabase().select().from(schema.postSaleRules).where(eq(schema.postSaleRules.tenantId, tenantId));
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return { ready: true, rules: AUTO_RULE_KEYS.map((key) => parseAutoRuleRow(key, byKey.get(key))) };
  } catch (error) {
    if (!isMissingTable(error)) console.warn("[post-sale-auto] rules_unavailable", { tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return { ready: false, rules: AUTO_RULE_KEYS.map((key) => parseAutoRuleRow(key, null)) };
  }
}

/** Empresas com alguma regra ligada (o motor só olha para elas). Sem tabela, nenhuma. */
export async function loadTenantsWithEnabledAutoRules(): Promise<string[]> {
  try {
    const rows = await getDatabase().selectDistinct({ tenantId: schema.postSaleRules.tenantId }).from(schema.postSaleRules).where(eq(schema.postSaleRules.enabled, true));
    return rows.map((row) => row.tenantId);
  } catch (error) {
    if (!isMissingTable(error)) console.warn("[post-sale-auto] enabled_rules_unavailable", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return [];
  }
}

export class AutoRulesTableMissingError extends Error {
  constructor() {
    super("A régua automática ainda não foi ativada no banco. Rode o SQL drizzle/0224_post_sale_rules.sql.");
  }
}

export async function saveAutoRule(tenantId: string, input: AutoRuleSettingsInput, userId: string): Promise<AutoRuleSettings> {
  const now = new Date();
  const values = {
    enabled: input.enabled,
    delayBusinessDays: input.delayBusinessDays,
    filters: { queueIds: [...new Set(input.filters.queueIds)], branchIds: [...new Set(input.filters.branchIds)], leadTypes: [...new Set(input.filters.leadTypes)] },
    dailyLimit: input.dailyLimit,
    pilot: { queueIds: [...new Set(input.pilot.queueIds)], brokerIds: [...new Set(input.pilot.brokerIds)] },
    updatedBy: userId,
    updatedAt: now,
  };
  try {
    const [row] = await getDatabase().insert(schema.postSaleRules).values({ id: randomUUID(), tenantId, key: input.key, ...values })
      .onConflictDoUpdate({ target: [schema.postSaleRules.tenantId, schema.postSaleRules.key], set: values })
      .returning();
    return parseAutoRuleRow(input.key as AutoRuleKey, row);
  } catch (error) {
    if (isMissingTable(error)) throw new AutoRulesTableMissingError();
    throw error;
  }
}
