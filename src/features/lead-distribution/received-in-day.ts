import { and, eq, gte, inArray, ne } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/**
 * Nivelamento do dia (DEC-154): a prioridade de quem recebe o próximo lead é
 * quem recebeu MENOS indicações no dia da operação (19:00 do dia útil anterior;
 * sexta 19:00 na segunda), dentro do plantão usado nesta escolha. Sem plantão,
 * considera somente indicações sem plantão.
 *
 * Indicação recebida = lead atribuído, tentativa de atribuição ou qualquer oferta
 * feita ao corretor no dia, inclusive EXPIRED, DECLINED e LOST: quem demorou ou
 * recusou não é reposto. Só a oferta CANCELLED (o sistema tirou o lead sem culpa
 * do corretor, ex.: sem canal de WhatsApp) não conta. Cada lead conta uma vez.
 */
export type DayReceipt = {
  brokerId: string | null;
  leadId: string;
  receivedAt: Date | null;
  /** Plantão ao qual a indicação pertence; null para distribuição sem plantão. */
  dutyScheduleId?: string | null;
  /** Só para ofertas: o status da oferta. */
  offerStatus?: string | null;
};

export const NON_COUNTING_OFFER_STATUS = "CANCELLED";

export function countsAsReceived(receipt: DayReceipt, since: Date) {
  return receipt.brokerId !== null
    && receipt.receivedAt !== null
    && receipt.receivedAt >= since
    && receipt.offerStatus !== NON_COUNTING_OFFER_STATUS;
}

/** A missing/null entry means this choice has no plantão for that broker. */
export type DutyScheduleIdByBroker = Readonly<Record<string, string | null | undefined>>;

/** Leads distintos recebidos por corretor no plantão desta escolha. */
export function countReceivedInDayByBroker(
  receipts: readonly DayReceipt[],
  since: Date,
  scheduleIdByBroker: DutyScheduleIdByBroker = {},
): Map<string, number> {
  const leadsByBroker = new Map<string, Set<string>>();
  for (const receipt of receipts) {
    if (!countsAsReceived(receipt, since)) continue;
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
 * chamador (que já traz os desempates do ranking e o sorteio dos empates).
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
    // Fora do mapa = fora do plantão ativo (tier 1), nunca o primeiro da fila.
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

type DatabaseLike = Pick<ReturnType<typeof getDatabase>, "select">;

/** Lê indicações do dia por corretor e pelo plantão usado nesta escolha. */
export async function loadReceivedInDayByBroker(
  db: DatabaseLike,
  tenantId: string,
  brokerIds: readonly string[],
  since: Date,
  scheduleIdByBroker: DutyScheduleIdByBroker = {},
) {
  if (!brokerIds.length) return new Map<string, number>();
  const ids = [...brokerIds];
  // Em sequência: dentro da transação da trava a conexão é uma só.
  const leads = await db.select({ brokerId: schema.leads.corretorId, leadId: schema.leads.id, receivedAt: schema.leads.assignedAt, dutyScheduleId: schema.leads.dutyScheduleId })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), inArray(schema.leads.corretorId, ids), gte(schema.leads.assignedAt, since)));
  const attempts = await db.select({ brokerId: schema.leadAssignmentAttempts.brokerId, leadId: schema.leadAssignmentAttempts.leadId, receivedAt: schema.leadAssignmentAttempts.assignedAt, dutyScheduleId: schema.leadAssignmentAttempts.dutyScheduleId })
    .from(schema.leadAssignmentAttempts)
    .where(and(eq(schema.leadAssignmentAttempts.tenantId, tenantId), inArray(schema.leadAssignmentAttempts.brokerId, ids), gte(schema.leadAssignmentAttempts.assignedAt, since)));
  const offers = await db.select({ brokerId: schema.leadOffers.brokerId, leadId: schema.leadOffers.leadId, receivedAt: schema.leadOffers.offeredAt, dutyScheduleId: schema.leadOffers.dutyScheduleId, offerStatus: schema.leadOffers.status })
    .from(schema.leadOffers)
    .where(and(
      eq(schema.leadOffers.tenantId, tenantId),
      inArray(schema.leadOffers.brokerId, ids),
      gte(schema.leadOffers.offeredAt, since),
      ne(schema.leadOffers.status, NON_COUNTING_OFFER_STATUS),
    ));
  return countReceivedInDayByBroker([...leads, ...attempts, ...offers], since, scheduleIdByBroker);
}
