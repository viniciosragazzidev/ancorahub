import "server-only";

import { and, desc, eq, gte, isNull, lt, ne } from "drizzle-orm";

import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type DutyNowLead = {
  leadId: string;
  name: string;
  /** "oferta" (plantão offer) or "atribuição" (direct). */
  origin: "oferta" | "atribuicao";
  /** Offer outcome or lead step, ready to show. */
  status: string;
  tone: "ok" | "wait" | "lost";
  at: Date;
  /** Seconds from the offer to the accept, when accepted. */
  acceptSeconds: number | null;
  /** Only a lead that is still the broker's opens (declined/expired/reassigned ones would land on "no access"). */
  openable: boolean;
};

export type DutyNow = {
  scheduleName: string;
  queueName: string | null;
  branchName: string | null;
  startsAt: Date;
  endsAt: Date;
  state: "ativo" | "pausado" | "aguardando";
  leads: DutyNowLead[];
  totals: { offered: number; accepted: number; missed: number; started: number; medianAcceptSeconds: number | null };
};

const OFFER_LABEL: Record<string, { status: string; tone: DutyNowLead["tone"] }> = {
  ACCEPTED: { status: "Aceito", tone: "ok" },
  DECLINED: { status: "Recusado", tone: "lost" },
  EXPIRED: { status: "Expirou", tone: "lost" },
  PENDING: { status: "Esperando você", tone: "wait" },
  SENT: { status: "Esperando você", tone: "wait" },
  DELIVERED: { status: "Esperando você", tone: "wait" },
  READ: { status: "Esperando você", tone: "wait" },
};

const NOT_STARTED = ["new", "distributed"];

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * The broker's plantão happening now: its window and every lead received in it
 * (offers of this plantão and direct assignments inside the window). Only the
 * logged broker's own data. Null when no plantão is active.
 */
export async function getDutyNow(now = new Date()): Promise<DutyNow | null> {
  const [context, data] = await Promise.all([getRequiredTenantContext(), getCachedBrokerWorkspaceData()]);
  const active = data.duty?.active;
  if (!active || context.role !== "broker") return null;
  const db = getDatabase();

  const [offers, assigned] = await Promise.all([
    db.select({
      leadId: schema.leadOffers.leadId,
      name: schema.leads.nome,
      status: schema.leadOffers.status,
      offeredAt: schema.leadOffers.offeredAt,
      acceptedAt: schema.leadOffers.acceptedAt,
      expiresAt: schema.leadOffers.expiresAt,
      leadStatus: schema.leads.status,
      leadOwner: schema.leads.corretorId,
    }).from(schema.leadOffers)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.leadOffers.leadId), eq(schema.leads.tenantId, schema.leadOffers.tenantId)))
      .where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        eq(schema.leadOffers.brokerId, context.userId),
        eq(schema.leadOffers.dutyScheduleId, active.scheduleId),
        isNull(schema.leads.deletedAt),
        ne(schema.leadOffers.status, "CANCELLED"),
        gte(schema.leadOffers.offeredAt, active.startsAt),
        lt(schema.leadOffers.offeredAt, active.endsAt),
      ))
      .orderBy(desc(schema.leadOffers.offeredAt))
      .limit(100),
    db.select({ leadId: schema.leads.id, name: schema.leads.nome, status: schema.leads.status, assignedAt: schema.leads.assignedAt, serviceStartedAt: schema.leads.serviceStartedAt })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.corretorId, context.userId),
        isNull(schema.leads.deletedAt),
        gte(schema.leads.assignedAt, active.startsAt),
        lt(schema.leads.assignedAt, active.endsAt),
      ))
      .orderBy(desc(schema.leads.assignedAt))
      .limit(100),
  ]);

  const byLead = new Map<string, DutyNowLead>();
  for (const offer of offers) {
    if (byLead.has(offer.leadId)) continue;
    const overdue = !offer.acceptedAt && ["PENDING", "SENT", "DELIVERED", "READ"].includes(offer.status) && offer.expiresAt <= now;
    const label = overdue ? { status: "Expirou", tone: "lost" as const } : OFFER_LABEL[offer.status] ?? { status: offer.status, tone: "wait" as const };
    const stillMine = Boolean(offer.acceptedAt) && offer.leadOwner === context.userId;
    byLead.set(offer.leadId, {
      leadId: offer.leadId,
      name: offer.name,
      origin: "oferta",
      // Accepted and later reassigned: the step belongs to the other broker now.
      status: stillMine ? LEAD_STATUS_LABELS[offer.leadStatus] ?? label.status : offer.acceptedAt ? "Repassado" : label.status,
      tone: stillMine ? "ok" : offer.acceptedAt ? "lost" : label.tone,
      at: offer.offeredAt,
      acceptSeconds: offer.acceptedAt ? Math.max(0, Math.round((offer.acceptedAt.getTime() - offer.offeredAt.getTime()) / 1000)) : null,
      openable: stillMine,
    });
  }
  for (const lead of assigned) {
    if (byLead.has(lead.leadId) || !lead.assignedAt) continue;
    byLead.set(lead.leadId, { leadId: lead.leadId, name: lead.name, origin: "atribuicao", status: LEAD_STATUS_LABELS[lead.status] ?? lead.status, tone: "ok", at: lead.assignedAt, acceptSeconds: null, openable: true });
  }
  const leads = [...byLead.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
  // A lead of this plantão already moved past "novo/distribuído" = service started.
  const startedIds = new Set([
    ...offers.filter((offer) => offer.acceptedAt && offer.leadOwner === context.userId && !NOT_STARTED.includes(offer.leadStatus)).map((offer) => offer.leadId),
    ...assigned.filter((lead) => !NOT_STARTED.includes(lead.status)).map((lead) => lead.leadId),
  ]);
  const offerRows = leads.filter((lead) => lead.origin === "oferta");

  return {
    scheduleName: active.scheduleName,
    queueName: active.queueName,
    branchName: active.branchName,
    startsAt: active.startsAt,
    endsAt: active.endsAt,
    state: active.presenceStatus === "pending" ? "aguardando" : active.paused ? "pausado" : "ativo",
    leads,
    totals: {
      offered: offerRows.length,
      accepted: offerRows.filter((lead) => lead.acceptSeconds !== null).length,
      missed: offerRows.filter((lead) => lead.tone === "lost").length,
      started: startedIds.size,
      medianAcceptSeconds: median(offerRows.map((lead) => lead.acceptSeconds).filter((value): value is number => value !== null)),
    },
  };
}
