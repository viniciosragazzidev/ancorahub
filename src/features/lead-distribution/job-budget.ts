import { isNull, lte, ne, or, type SQLWrapper } from "drizzle-orm";

/**
 * Starvation guard of the distribution job (09/11, Venâncio Leads / Plantão 7° Andar).
 *
 * Each run has a time budget and handles a batch in waves, hottest first. A few hot/warm
 * leads that hit the 45 s per-lead ceiling every run ate the whole budget, so the cold wave
 * was claimed and handed back untouched every 2 minutes, all day: six cold leads with the
 * plantão on and three brokers present were never offered.
 */

/** Per-lead ceiling hit: the job waits 5 minutes before trying again. */
export const LEAD_TIMEOUT_CODE = "LEAD_TIMEOUT";

/**
 * The plantão wake-up brings due every job of a running duty. It must not cancel the
 * 5-minute pause of a lead that just hit the per-lead ceiling: woken every run, the same
 * slow leads came back first and used up the budget of every run.
 */
export function plantaoWakeKeepsTimeoutPause(job: { lastErrorCode: string | null; runAfter: Date }, now: Date) {
  return job.lastErrorCode === LEAD_TIMEOUT_CODE && job.runAfter.getTime() > now.getTime();
}

/** SQL counterpart for the plantão wake-up query: true for the jobs it may bring due. */
export function plantaoWakeAllowedCondition(lastErrorCode: SQLWrapper, runAfter: SQLWrapper, now: Date) {
  return or(isNull(lastErrorCode), ne(lastErrorCode, LEAD_TIMEOUT_CODE), lte(runAfter, now));
}
