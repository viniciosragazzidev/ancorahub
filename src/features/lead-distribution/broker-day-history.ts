import "server-only";

import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { readMetaLeadDisplayDetails } from "@/features/leads/meta-lead-display";
import { DUTY_LEADS_FROM_PREVIOUS_DAY_AT } from "./duty-presence-domain";

export type BrokerDayHistoryLead = {
  id: string;
  name: string;
  assignedAt: string | null;
  firstContactAt: string | null;
  status: string;
  qualificationStatus: string | null;
  queueName: string | null;
  whatsapp: boolean;
};

export type BrokerDayHistoryOffer = {
  id: string;
  leadId: string;
  leadName: string;
  status: string;
  offeredAt: string;
  answeredAt: string | null;
};

export type BrokerDayHistory = {
  brokerName: string;
  since: string;
  until: string | null;
  leads: BrokerDayHistoryLead[];
  offers: BrokerDayHistoryOffer[];
  summary: { received: number; contacted: number; offered: number; accepted: number; declined: number; expired: number; pending: number };
};

const TIMEZONE = "America/Sao_Paulo";

/** Start of the operation's day: 19:00 of yesterday (or of today, once past 19:00). */
export function operationDayStart(now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const [cutHour, cutMinute] = DUTY_LEADS_FROM_PREVIOUS_DAY_AT.split(":").map(Number);
  // São Paulo has no DST: UTC-3 all year.
  const todayCut = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), cutHour + 3, cutMinute));
  return todayCut <= now ? todayCut : new Date(todayCut.getTime() - 24 * 60 * 60 * 1000);
}

/** The operation's day of a past plantão date ("YYYY-MM-DD"): 19:00 of the day before to 19:00 of that day. */
export function operationDayOf(dutyDate: string) {
  const [year, month, day] = dutyDate.split("-").map(Number);
  const [cutHour, cutMinute] = DUTY_LEADS_FROM_PREVIOUS_DAY_AT.split(":").map(Number);
  const until = new Date(Date.UTC(year, month - 1, day, cutHour + 3, cutMinute));
  return { since: new Date(until.getTime() - 24 * 60 * 60 * 1000), until };
}

/**
 * What a broker received in the operation's day: leads handed to them and every
 * offer sent. Today's (open) day by default; a past plantão's day with `dutyDate`.
 */
export async function getBrokerDayHistory(tenantId: string, brokerId: string, options: { now?: Date; dutyDate?: string | null } = {}): Promise<BrokerDayHistory | null> {
  const db = getDatabase();
  const past = options.dutyDate ? operationDayOf(options.dutyDate) : null;
  const since = past?.since ?? operationDayStart(options.now ?? new Date());
  const until = past?.until ?? null;
  const [broker] = await db.select({ name: schema.user.name }).from(schema.user)
    .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, tenantId)))
    .where(eq(schema.user.id, brokerId)).limit(1);
  if (!broker) return null;

  const [leadRows, offerRows] = await Promise.all([
    db.select({
      id: schema.leads.id,
      name: schema.leads.nome,
      assignedAt: schema.leads.assignedAt,
      firstContactAt: schema.leads.firstContactAt,
      status: schema.leads.status,
      qualificationStatus: schema.leads.qualificationStatus,
      queueName: schema.leadQueues.name,
      sourceChannel: schema.leads.sourceChannel,
      sourceMetadata: schema.leads.sourceMetadata,
    }).from(schema.leads)
      .leftJoin(schema.leadQueues, eq(schema.leadQueues.id, schema.leads.queueId))
      .where(and(
        eq(schema.leads.tenantId, tenantId),
        eq(schema.leads.corretorId, brokerId),
        gte(schema.leads.assignedAt, since),
        until ? lt(schema.leads.assignedAt, until) : undefined,
        isNull(schema.leads.deletedAt),
      ))
      .orderBy(desc(schema.leads.assignedAt)),
    db.select({
      id: schema.leadOffers.id,
      leadId: schema.leadOffers.leadId,
      leadName: schema.leads.nome,
      status: schema.leadOffers.status,
      offeredAt: schema.leadOffers.offeredAt,
      acceptedAt: schema.leadOffers.acceptedAt,
      declinedAt: schema.leadOffers.declinedAt,
    }).from(schema.leadOffers)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.leadOffers.leadId))
      .where(and(
        eq(schema.leadOffers.tenantId, tenantId),
        eq(schema.leadOffers.brokerId, brokerId),
        gte(schema.leadOffers.offeredAt, since),
        until ? lt(schema.leadOffers.offeredAt, until) : undefined,
      ))
      .orderBy(desc(schema.leadOffers.offeredAt)),
  ]);

  const leads = leadRows.map((lead) => ({
    id: lead.id,
    name: lead.name,
    assignedAt: lead.assignedAt?.toISOString() ?? null,
    firstContactAt: lead.firstContactAt?.toISOString() ?? null,
    status: lead.status,
    qualificationStatus: lead.qualificationStatus,
    queueName: lead.queueName,
    whatsapp: readMetaLeadDisplayDetails(lead.sourceChannel, lead.sourceMetadata).entry === "whatsapp",
  }));
  const offers = offerRows.map((offer) => ({
    id: offer.id,
    leadId: offer.leadId,
    leadName: offer.leadName,
    status: offer.status,
    offeredAt: offer.offeredAt.toISOString(),
    answeredAt: (offer.acceptedAt ?? offer.declinedAt)?.toISOString() ?? null,
  }));
  const countOffers = (...statuses: string[]) => offers.filter((offer) => statuses.includes(offer.status)).length;

  return {
    brokerName: broker.name,
    since: since.toISOString(),
    until: until?.toISOString() ?? null,
    leads,
    offers,
    summary: {
      received: leads.length,
      contacted: leads.filter((lead) => lead.firstContactAt).length,
      offered: offers.length,
      accepted: countOffers("ACCEPTED"),
      declined: countOffers("DECLINED"),
      expired: countOffers("EXPIRED", "TIMEOUT"),
      pending: countOffers("PENDING", "SENT", "DELIVERED", "READ"),
    },
  };
}
