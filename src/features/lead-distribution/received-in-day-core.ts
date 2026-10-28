/**
 * Pure helpers for the operation-day receipt balance. Keep this module free
 * of database imports so the queue preview can use the same rule in a client
 * component without pulling server-only code into the browser bundle.
 */
export type DayReceipt = {
  brokerId: string | null;
  leadId: string;
  receivedAt: Date | null;
  dutyScheduleId?: string | null;
  offerStatus?: string | null;
};

export const NON_COUNTING_OFFER_STATUS = "CANCELLED";

export function countsAsReceived(receipt: DayReceipt, since: Date) {
  return receipt.brokerId !== null
    && receipt.receivedAt !== null
    && receipt.receivedAt >= since
    && receipt.offerStatus !== NON_COUNTING_OFFER_STATUS;
}

/** A stretch of the day whose receipts do not level the plantão. */
export type ReceiptGap = { from: Date; until: Date };

/**
 * The night extra (DEC-152) of today, once it has closed: what the extra brokers got there does not
 * level the regular plantão (28/10: brokers with 7 extra leads waited while the others caught up).
 * While the extra runs, null: its receipts level the extra itself. São Paulo is UTC-3 all year.
 */
export function overnightExtraReceiptGap(now: Date, extraStartsAt: string, extraEndsAt: string): ReceiptGap | null {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const at = (clock: string) => {
    const [hour, minute] = clock.split(":").map(Number);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour + 3, minute));
  };
  const from = at(extraStartsAt);
  const until = at(extraEndsAt);
  return from < until && now >= until ? { from, until } : null;
}

export type DutyScheduleIdByBroker = Readonly<Record<string, string | null | undefined>>;

/** The preview and the locked distribution use the same occurrence scope. */
export function getDutyScheduleReceiptScope<T extends DutyScheduleIdByBroker>(
  scheduleIdByBroker: T,
  hasExplicitDutyScope: boolean,
): T {
  return hasExplicitDutyScope ? scheduleIdByBroker : {} as T;
}

/** Leads distintos recebidos por corretor no plantão desta escolha. */
export function countReceivedInDayByBroker(
  receipts: readonly DayReceipt[],
  since: Date,
  scheduleIdByBroker: DutyScheduleIdByBroker = {},
  gap: ReceiptGap | null = null,
): Map<string, number> {
  const leadsByBroker = new Map<string, Set<string>>();
  for (const receipt of receipts) {
    if (!countsAsReceived(receipt, since)) continue;
    if (gap && receipt.receivedAt! >= gap.from && receipt.receivedAt! < gap.until) continue;
    const expectedScheduleId = scheduleIdByBroker[receipt.brokerId!] ?? null;
    if ((receipt.dutyScheduleId ?? null) !== expectedScheduleId) continue;
    const leads = leadsByBroker.get(receipt.brokerId!) ?? new Set<string>();
    leads.add(receipt.leadId);
    leadsByBroker.set(receipt.brokerId!, leads);
  }
  return new Map([...leadsByBroker].map(([brokerId, leads]) => [brokerId, leads.size]));
}

/**
 * Próximo corretor a tentar, com as contagens lidas sob a trava da escolha.
 * Ordem: grupo (0 = no plantão ativo antes) > menos recebidos no dia > ordem do
 * chamador (que já traz os demais desempates).
 */
export function pickNextByReceivedInDay(
  orderedBrokerIds: readonly string[],
  receivedByBroker: ReadonlyMap<string, number>,
  tierByBroker: Readonly<Record<string, number>> = {},
): string | null {
  let best: string | null = null;
  let bestTier = 0;
  let bestReceived = 0;
  for (const brokerId of orderedBrokerIds) {
    const tier = tierByBroker[brokerId] ?? 1;
    const received = receivedByBroker.get(brokerId) ?? 0;
    if (best === null || tier < bestTier || (tier === bestTier && received < bestReceived)) {
      best = brokerId;
      bestTier = tier;
      bestReceived = received;
    }
  }
  return best;
}
