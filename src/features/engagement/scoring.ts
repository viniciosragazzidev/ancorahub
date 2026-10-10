/**
 * Pure scoring: one system fact -> one points candidate (or none).
 * No database here, so every rule is tested in isolation.
 */
import { createHash } from "node:crypto";

import { FAST_ACCEPT_MAX_SECONDS, FIRST_CONTACT_SLA_POINTS, FIRST_CONTACT_TIERS, NOTE_MIN_LENGTH, RETURN_MIN_LEAD_HOURS, type EngagementRule, type EngagementRuleKey } from "./catalog";

export type PointsCandidate = {
  brokerId: string;
  ruleKey: EngagementRuleKey;
  points: number;
  entityType: "lead" | "offer" | "task" | "note" | "presence";
  entityId: string;
  leadId: string | null;
  occurredAt: Date;
  /** (tenant, key) is unique: the same fact never scores twice. */
  idempotencyKey: string;
  metadata: Record<string, unknown>;
};

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
/** "YYYY-MM-DD" of the instant in America/Sao_Paulo. */
export function periodDay(date: Date) {
  return DAY_FORMAT.format(date);
}

const seconds = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 1000);

/** First message actually sent to the client after the assignment (evidence, not the "Registrar contato" tap). */
export function scoreFirstContact(input: { leadId: string; brokerId: string; assignedAt: Date; firstOutboundAt: Date; slaMinutes: number }, rule: EngagementRule): PointsCandidate | null {
  if (!rule.enabled) return null;
  const latency = seconds(input.assignedAt, input.firstOutboundAt);
  if (latency < 0) return null;
  const tiers: { tier: string; maxSeconds: number; points: number }[] = [...FIRST_CONTACT_TIERS];
  if (input.slaMinutes * 60 > tiers[tiers.length - 1]!.maxSeconds) tiers.push({ tier: "sla", maxSeconds: input.slaMinutes * 60, points: FIRST_CONTACT_SLA_POINTS });
  const tier = tiers.find((candidate) => latency <= candidate.maxSeconds);
  if (!tier) return null;
  // The tenant may scale the top tier; lower tiers keep their proportion.
  const points = Math.round((tier.points * rule.points) / FIRST_CONTACT_TIERS[0].points);
  if (points <= 0) return null;
  return {
    brokerId: input.brokerId,
    ruleKey: "contact.first",
    points,
    entityType: "lead",
    entityId: input.leadId,
    leadId: input.leadId,
    occurredAt: input.firstOutboundAt,
    idempotencyKey: `contact.first:${input.leadId}:${input.brokerId}:${input.assignedAt.getTime()}`,
    metadata: { tier: tier.tier, latencySeconds: latency },
  };
}

export function scoreFastAccept(input: { offerId: string; leadId: string; brokerId: string; offeredAt: Date; acceptedAt: Date }, rule: EngagementRule): PointsCandidate | null {
  if (!rule.enabled) return null;
  const latency = seconds(input.offeredAt, input.acceptedAt);
  if (latency < 0 || latency > FAST_ACCEPT_MAX_SECONDS) return null;
  return {
    brokerId: input.brokerId,
    ruleKey: "offer.fast_accept",
    points: rule.points,
    entityType: "offer",
    entityId: input.offerId,
    leadId: input.leadId,
    occurredAt: input.acceptedAt,
    idempotencyKey: `offer.fast_accept:${input.offerId}:${input.brokerId}`,
    metadata: { latencySeconds: latency },
  };
}

/** A return done on time. A task the broker set for themself must be scheduled RETURN_MIN_LEAD_HOURS ahead. */
export function scoreReturnOnTime(input: { taskId: string; leadId: string; assignedTo: string; createdBy: string; createdAt: Date; dueAt: Date; completedAt: Date }, rule: EngagementRule): PointsCandidate | null {
  if (!rule.enabled) return null;
  if (input.completedAt.getTime() > input.dueAt.getTime()) return null;
  const selfScheduled = input.createdBy === input.assignedTo;
  if (selfScheduled && input.dueAt.getTime() - input.createdAt.getTime() < RETURN_MIN_LEAD_HOURS * 3_600_000) return null;
  return {
    brokerId: input.assignedTo,
    ruleKey: "return.on_time",
    points: rule.points,
    entityType: "task",
    entityId: input.taskId,
    leadId: input.leadId,
    occurredAt: input.completedAt,
    idempotencyKey: `return.on_time:${input.taskId}:${input.assignedTo}`,
    metadata: { selfScheduled },
  };
}

export function normalizeNote(content: string) {
  return content.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** A real note: long enough, and the same text the same day scores once (copy-paste does not farm). */
export function scoreServiceNote(input: { noteId: string; leadId: string; brokerId: string; content: string; createdAt: Date }, rule: EngagementRule): PointsCandidate | null {
  if (!rule.enabled) return null;
  const normalized = normalizeNote(input.content);
  if (normalized.length < NOTE_MIN_LENGTH) return null;
  const fingerprint = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return {
    brokerId: input.brokerId,
    ruleKey: "note.service",
    points: rule.points,
    entityType: "note",
    entityId: input.noteId,
    leadId: input.leadId,
    occurredAt: input.createdAt,
    idempotencyKey: `note.service:${input.brokerId}:${periodDay(input.createdAt)}:${fingerprint}`,
    metadata: { length: normalized.length },
  };
}

/** Only the broker's own click counts (a manager release is not the broker's action). */
export function scorePresence(input: { confirmationId: string; brokerId: string; confirmedAt: Date; confirmedBy: string | null }, rule: EngagementRule): PointsCandidate | null {
  if (!rule.enabled || input.confirmedBy) return null;
  return {
    brokerId: input.brokerId,
    ruleKey: "duty.presence",
    points: rule.points,
    entityType: "presence",
    entityId: input.confirmationId,
    leadId: null,
    occurredAt: input.confirmedAt,
    idempotencyKey: `duty.presence:${input.confirmationId}:${input.brokerId}`,
    metadata: {},
  };
}

/**
 * Daily caps per broker and rule. `existing` counts what is already in the
 * ledger for that broker/rule/day; candidates are taken in time order.
 */
export function applyDailyCaps(candidates: PointsCandidate[], rules: Record<EngagementRuleKey, EngagementRule>, existing: Map<string, number>) {
  const used = new Map(existing);
  const kept: PointsCandidate[] = [];
  for (const candidate of [...candidates].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    const cap = rules[candidate.ruleKey].dailyCap;
    if (cap === null) { kept.push(candidate); continue; }
    const key = capKey(candidate.brokerId, candidate.ruleKey, periodDay(candidate.occurredAt));
    const count = used.get(key) ?? 0;
    if (count >= cap) continue;
    used.set(key, count + 1);
    kept.push(candidate);
  }
  return kept;
}

export const capKey = (brokerId: string, ruleKey: string, day: string) => `${brokerId}|${ruleKey}|${day}`;
