import "server-only";

import { and, desc, eq, gte, isNull, lt, ne, or } from "drizzle-orm";

import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import type { BrokerActiveDuty } from "@/features/broker-workspace/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { buildDutyNowLeads, isWithinDutyWindow, selectDutyNowOccurrence } from "./duty-now-domain";

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
  const active = selectDutyNowOccurrence(running, scheduleId);
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

  const leads = buildDutyNowLeads({ offers, assigned, active, brokerId, now });
  // A lead of this plantão already moved past "novo/distribuído" = service started.
  const startedIds = new Set([
    ...offers.filter((offer) => isWithinDutyWindow(offer.offeredAt, active.startsAt, active.endsAt) && offer.acceptedAt && offer.leadOwner === brokerId && !NOT_STARTED.includes(offer.leadStatus)).map((offer) => offer.leadId),
    ...assigned.filter((lead) => isWithinDutyWindow(lead.assignedAt, active.startsAt, active.endsAt) && !NOT_STARTED.includes(lead.status)).map((lead) => lead.leadId),
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
