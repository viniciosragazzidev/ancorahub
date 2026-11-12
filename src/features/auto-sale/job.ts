import "server-only";

import { and, asc, eq, isNotNull, lte } from "drizzle-orm";

import { getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { withJobLease } from "@/shared/db/job-lease";
import { isUndefinedTableError } from "@/shared/db/postgres-errors";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { dispatchAutoSaleOutbox } from "./dispatch";
import { closeIdleDeals, runDealTurn, runDueFollowUps } from "./runner";

/**
 * Rodada do robô da Venda Automatizada (`/api/internal/jobs/auto-sale`, `* * * * *`): responde às
 * rajadas vencidas (até 3 negociações), despacha o outbox aprovado, dispara follow-ups e devolve
 * negociações paradas. Uma rodada por vez (lease); kill switch global desligado não faz nada.
 */
export async function runAutoSaleSweep(now = new Date()) {
  if ((await getFeatureFlag(FEATURE_FLAGS.AUTO_SALE_GLOBAL).catch(() => "true")) === "false") return { skipped: "global_off" as const };
  try {
    const leased = await withJobLease("auto-sale", 110_000, async () => {
      const due = await getDatabase().select().from(schema.autoSaleDeals)
        .where(and(eq(schema.autoSaleDeals.status, "active"), isNotNull(schema.autoSaleDeals.replyDueAt), lte(schema.autoSaleDeals.replyDueAt, now)))
        .orderBy(asc(schema.autoSaleDeals.replyDueAt)).limit(3);
      const turns: string[] = [];
      for (const deal of due) {
        const outcome = await runDealTurn(deal, { now }).catch((error) => {
          console.error("[auto-sale] turn_failed", { dealId: deal.id, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
          return { status: "error" as const };
        });
        turns.push(outcome.status);
      }
      const followUps = await runDueFollowUps(now);
      const outbox = await dispatchAutoSaleOutbox(now);
      const idle = await closeIdleDeals(now);
      return { turns, followUps, outbox, idle };
    });
    return leased.acquired ? { ...leased.value } : { skipped: "lease_busy" as const };
  } catch (error) {
    if (isUndefinedTableError(error)) return { skipped: "table_missing" as const };
    throw error;
  }
}
