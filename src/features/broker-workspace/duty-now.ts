import "server-only";

import { and, desc, eq, gte, isNull, lt, ne, or } from "drizzle-orm";

import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import type { BrokerActiveDuty } from "@/features/broker-workspace/queries";
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
  scheduleId: string;
  /** The other plantões running now, to switch between them (PME online + Presencial at once). */
  choices: Array<{ scheduleId: string; scheduleName: string; presencial: boolean }>;
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
export async function getDutyNow(now = new Date(), scheduleId?: string | null): Promise<DutyNow | null> {
  const [context, data] = await Promise.all([getRequiredTenantContext(), getCachedBrokerWorkspaceData()]);
  const running = data.duty?.activeAll?.length ? data.duty.activeAll : data.duty?.active ? [data.duty.active] : [];
  // The plantão asked for (?plantao=), else the first one running.
  const active = running.find((duty) => duty.scheduleId === scheduleId) ?? running[0];
  if (!active || context.role !== "broker") return null;
  return loadDutyNow({ tenantId: context.tenantId, brokerId: context.userId, now, running, active });
}

/**
 * The leads of one broker in one plantão that is running now (the broker's own, or a broker
 * of the viewer's scope when a supervisor or the gestor opens it). `running` is every plantão
 * the broker has now; the first one decides which leads without a plantão belong here.
 */
export async function loadDutyNow(input: { tenantId: string; brokerId: string; now: Date; running: BrokerActiveDuty[]; active: BrokerActiveDuty }): Promise<DutyNow> {
  const { tenantId, brokerId, now, running, active } = input;
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
        eq(schema.leadOffers.tenantId, tenantId),
        eq(schema.leadOffers.brokerId, brokerId),
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
        eq(schema.leads.tenantId, tenantId),
        eq(schema.leads.corretorId, brokerId),
        isNull(schema.leads.deletedAt),
        // Only leads of this plantão (or with no plantão): with PME and Presencial
        // at once, a lead offered in one showed up in the other as "atribuído".
        // A lead with no plantão shows in the first one only, never twice.
        active.scheduleId === running[0]?.scheduleId
          ? or(isNull(schema.leads.dutyScheduleId), eq(schema.leads.dutyScheduleId, active.scheduleId))
          : eq(schema.leads.dutyScheduleId, active.scheduleId),
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
    const stillMine = Boolean(offer.acceptedAt) && offer.leadOwner === brokerId;
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
    ...offers.filter((offer) => offer.acceptedAt && offer.leadOwner === brokerId && !NOT_STARTED.includes(offer.leadStatus)).map((offer) => offer.leadId),
    ...assigned.filter((lead) => !NOT_STARTED.includes(lead.status)).map((lead) => lead.leadId),
  ]);
  const offerRows = leads.filter((lead) => lead.origin === "oferta");

  return {
    scheduleId: active.scheduleId,
    choices: running.map((duty) => ({ scheduleId: duty.scheduleId, scheduleName: duty.scheduleName, presencial: duty.attendanceMode === "presencial" })),
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
