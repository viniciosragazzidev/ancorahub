import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

export type DutyNowLead = {
  leadId: string;
  name: string;
  origin: "oferta" | "atribuicao";
  status: string;
  tone: "ok" | "wait" | "lost";
  at: Date;
  acceptSeconds: number | null;
  openable: boolean;
};

export type DutyOfferRow = {
  leadId: string;
  name: string;
  status: string;
  offeredAt: Date;
  acceptedAt: Date | null;
  expiresAt: Date;
  leadStatus: string;
  leadOwner: string | null;
};

export type DutyAssignedRow = { leadId: string; name: string; status: string; assignedAt: Date | null };

const OFFER_LABEL: Record<string, { status: string; tone: DutyNowLead["tone"] }> = {
  ACCEPTED: { status: "Aceito", tone: "ok" },
  DECLINED: { status: "Recusado", tone: "lost" },
  EXPIRED: { status: "Expirou", tone: "lost" },
  PENDING: { status: "Esperando você", tone: "wait" },
  SENT: { status: "Esperando você", tone: "wait" },
  DELIVERED: { status: "Esperando você", tone: "wait" },
  READ: { status: "Esperando você", tone: "wait" },
};

export function isWithinDutyWindow(at: Date | null, startsAt: Date, endsAt: Date) {
  return Boolean(at && at.getTime() >= startsAt.getTime() && at.getTime() < endsAt.getTime());
}

/** Defence in depth: the plantão view cannot display old leads even if a query is widened later. */
export function buildDutyNowLeads(input: {
  offers: DutyOfferRow[];
  assigned: DutyAssignedRow[];
  active: { startsAt: Date; endsAt: Date };
  brokerId: string;
  now: Date;
}): DutyNowLead[] {
  const byLead = new Map<string, DutyNowLead>();
  for (const offer of input.offers) {
    if (byLead.has(offer.leadId) || !isWithinDutyWindow(offer.offeredAt, input.active.startsAt, input.active.endsAt)) continue;
    const overdue = !offer.acceptedAt && ["PENDING", "SENT", "DELIVERED", "READ"].includes(offer.status) && offer.expiresAt <= input.now;
    const label = overdue ? { status: "Expirou", tone: "lost" as const } : OFFER_LABEL[offer.status] ?? { status: offer.status, tone: "wait" as const };
    const stillMine = Boolean(offer.acceptedAt) && offer.leadOwner === input.brokerId;
    byLead.set(offer.leadId, {
      leadId: offer.leadId,
      name: offer.name,
      origin: "oferta",
      status: stillMine ? LEAD_STATUS_LABELS[offer.leadStatus] ?? label.status : offer.acceptedAt ? "Repassado" : label.status,
      tone: stillMine ? "ok" : offer.acceptedAt ? "lost" : label.tone,
      at: offer.offeredAt,
      acceptSeconds: offer.acceptedAt ? Math.max(0, Math.round((offer.acceptedAt.getTime() - offer.offeredAt.getTime()) / 1000)) : null,
      openable: stillMine,
    });
  }

  for (const lead of input.assigned) {
    if (byLead.has(lead.leadId) || !isWithinDutyWindow(lead.assignedAt, input.active.startsAt, input.active.endsAt)) continue;
    byLead.set(lead.leadId, {
      leadId: lead.leadId,
      name: lead.name,
      origin: "atribuicao",
      status: LEAD_STATUS_LABELS[lead.status] ?? lead.status,
      tone: "ok",
      at: lead.assignedAt!,
      acceptSeconds: null,
      openable: true,
    });
  }
  return [...byLead.values()].sort((left, right) => right.at.getTime() - left.at.getTime());
}
