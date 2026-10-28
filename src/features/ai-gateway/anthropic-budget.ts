import "server-only";

import { and, eq, gte, like, sql, sum } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import {
  AI_BUDGET_SETTING,
  aiBudgetLevel,
  anthropicCostUsd,
  budgetMonthKey,
  monthStartSaoPaulo,
  readBudgetUsd,
  type AiBudgetLevel,
} from "./anthropic-budget-domain";

export type AiBudgetState = { spentUsd: number; budgetUsd: number; ratio: number; level: AiBudgetLevel; monthStart: Date };

/** The month's sum reads every AI call of the month: computed at most every 5 minutes. */
const CACHE_MS = 5 * 60_000;
let cached: { at: number; state: AiBudgetState } | null = null;

/**
 * What the Anthropic credit spent this month, from the tokens logged on every successful call
 * (ai_attendance_logs, model "anthropic/…"). An estimate at list prices; the Console bill rules.
 */
export async function getAiBudgetState(now = new Date(), options: { fresh?: boolean } = {}): Promise<AiBudgetState> {
  if (!options.fresh && cached && now.getTime() - cached.at < CACHE_MS) return cached.state;
  const db = getDatabase();
  const monthStart = monthStartSaoPaulo(now);
  const [rows, budgetValue] = await Promise.all([
    db.select({
      model: schema.aiAttendanceLogs.modelUsed,
      input: sum(schema.aiAttendanceLogs.promptTokens),
      output: sum(schema.aiAttendanceLogs.completionTokens),
    }).from(schema.aiAttendanceLogs)
      .where(and(
        like(schema.aiAttendanceLogs.modelUsed, "anthropic/%"),
        eq(schema.aiAttendanceLogs.status, "success"),
        gte(schema.aiAttendanceLogs.createdAt, monthStart),
      ))
      .groupBy(schema.aiAttendanceLogs.modelUsed),
    getSystemSetting(AI_BUDGET_SETTING).catch(() => null),
  ]);
  const spentUsd = rows.reduce((total, row) => total + anthropicCostUsd(row.model, Number(row.input ?? 0), Number(row.output ?? 0)), 0);
  const budgetUsd = readBudgetUsd(budgetValue);
  const state = { spentUsd, budgetUsd, ratio: spentUsd / budgetUsd, level: aiBudgetLevel(spentUsd, budgetUsd), monthStart };
  cached = { at: now.getTime(), state };
  return state;
}

/** Over the monthly budget: the conversation analysis goes back to its economy pace. */
export async function isAiBudgetExceeded(now = new Date()) {
  return (await getAiBudgetState(now).catch(() => null))?.level === "exceeded";
}

/** Forgets the cached sum (after the budget is changed in Super-admin). */
export function resetAiBudgetCache() {
  cached = null;
}

/**
 * Warns the directors once per month and level (80% and 100%). The flag is written first,
 * so two runs at the same minute never warn twice.
 */
export async function notifyAiBudgetLevel(state: AiBudgetState, now = new Date()) {
  if (state.level === "ok") return;
  const flagKey = `ai_budget_alert_${budgetMonthKey(now)}_${state.level}`;
  const db = getDatabase();
  const claimed = await db.execute(sql`
    insert into system_settings (key, value, updated_at) values (${flagKey}, ${now.toISOString()}, now())
    on conflict (key) do nothing returning key
  `);
  const claimedRows = Array.isArray(claimed) ? claimed : (claimed as { rows?: unknown[] }).rows ?? [];
  if (!claimedRows.length) return;
  const directors = await db.select({ userId: schema.tenantMemberships.userId, tenantId: schema.tenantMemberships.tenantId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.tenantMemberships.tenantId))
    .where(and(eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active"), eq(schema.tenants.status, "active")));
  const spent = state.spentUsd.toFixed(2);
  const budget = state.budgetUsd.toFixed(0);
  const exceeded = state.level === "exceeded";
  const title = exceeded ? "Orçamento de IA do mês esgotado" : "Orçamento de IA em 80%";
  const message = exceeded
    ? `A IA já gastou US$ ${spent} de US$ ${budget} neste mês. A análise das conversas passou ao ritmo econômico (a cada 10 minutos); o robô de qualificação e o Jack continuam.`
    : `A IA já gastou US$ ${spent} de US$ ${budget} neste mês. Ao chegar em 100%, a análise das conversas passa ao ritmo econômico.`;
  await Promise.all(directors.map((director) => publishNotification({
    capability: "ai_budget",
    tenantId: director.tenantId,
    recipientUserId: director.userId,
    type: "ai_budget",
    title,
    message,
    url: "/super-admin/settings",
    tag: `ai-budget-${budgetMonthKey(now)}-${state.level}`,
    idempotencyKey: `${flagKey}:${director.userId}`,
  }).catch(() => undefined)));
}

export async function saveAiBudgetUsd(value: number, now = new Date()) {
  await setSystemSetting(AI_BUDGET_SETTING, String(value), now);
  resetAiBudgetCache();
}
