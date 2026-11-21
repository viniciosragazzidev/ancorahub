import { CADENCE } from "@/features/qualification-turbo/cadence";

import { currentField, deriveLeadJourney, type JourneyCode, type LeadJourney, type RecoveryMark } from "./journey";

/** Linha crua de listQualificationLeads (Postgres). */
export type QualificationLeadSource = {
  id: string;
  nome: string | null;
  telefone: string | null;
  status: string;
  qualification_status: string | null;
  corretor_id: string | null;
  assigned_at: string | Date | null;
  first_contact_at: string | Date | null;
  distribution_status: string | null;
  created_at: string | Date;
  source_channel: string | null;
  lives_count: number | null;
  queue_id: string | null;
  queue_name: string | null;
  broker_name: string | null;
  turbo: unknown;
  recovery: unknown;
  opt_out_at: string | Date | null;
  wrong_number_at: string | Date | null;
  collected_fields: unknown;
  inbound_count: number | null;
  last_inbound_at: string | Date | null;
  last_ai_at: string | Date | null;
  first_ai_at: string | Date | null;
  silence_sent: boolean | null;
};

/** Linha pronta para a tela (serializável). */
export type QualificationLeadRow = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  qualificationStatus: string | null;
  createdAt: string;
  queueId: string | null;
  queueName: string | null;
  brokerName: string | null;
  livesCount: number | null;
  sourceChannel: string | null;
  /** Campo que a IA vai pedir agora. */
  field: string | null;
  /** Toques automáticos de recuperação enviados / previstos. */
  touches: { sent: number; total: number };
  lastInboundAt: string | null;
  journey: LeadJourney;
};

type TurboTouch = { touch?: string; status?: string; at?: string };

function iso(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const MARKS: readonly RecoveryMark[] = ["call_queue", "bad_moment", "nurture", "do_not_contact"];

export function recoveryState(value: unknown): { state: RecoveryMark; until?: string | null } | null {
  if (!value || typeof value !== "object") return null;
  const state = (value as { state?: unknown }).state as RecoveryMark;
  if (!MARKS.includes(state)) return null;
  const until = (value as { until?: unknown }).until;
  return { state, until: typeof until === "string" ? until : null };
}

/**
 * Lê o estado do turbo (T1 a T4) e do follow-up de silêncio: quantos toques saíram e quando sai o próximo.
 * Quem nunca respondeu conta os lembretes do turbo; quem parou no meio conta o follow-up de silêncio.
 */
export function touchesOf(turbo: unknown, silenceSent: boolean, replied: boolean) {
  const state = turbo && typeof turbo === "object" ? (turbo as { firstContactAt?: string; touches?: TurboTouch[]; stoppedAt?: string }) : null;
  const touches = Array.isArray(state?.touches) ? state!.touches : [];
  const reminders = touches.filter((touch) => touch.touch && touch.touch !== "t0" && touch.touch !== "reactivation");
  const sent = reminders.filter((touch) => touch.status === "sent").length;
  if (replied) return { sent: silenceSent ? 1 : 0, total: 1, nextAt: null, stopped: silenceSent };
  const done = new Set(reminders.filter((touch) => touch.status === "sent" || touch.status === "skipped").map((touch) => touch.touch));
  const next = CADENCE.find((step) => !done.has(step.touch));
  const firstAt = state?.firstContactAt ? new Date(state.firstContactAt).getTime() : NaN;
  const nextAt = next && Number.isFinite(firstAt) && !state?.stoppedAt ? new Date(firstAt + next.afterMinutes * 60_000).toISOString() : null;
  return { sent, total: CADENCE.length, nextAt, stopped: Boolean(state?.stoppedAt) || !next };
}

export function buildQualificationRow(source: QualificationLeadSource, now = new Date()): QualificationLeadRow {
  const inboundCount = Number(source.inbound_count) || 0;
  const collected = Array.isArray(source.collected_fields) ? (source.collected_fields as unknown[]).filter((item): item is string => typeof item === "string") : [];
  const turboState = source.turbo && typeof source.turbo === "object" ? (source.turbo as { firstContactAt?: string }) : null;
  const touches = touchesOf(source.turbo, Boolean(source.silence_sent), inboundCount > 0);
  const journey = deriveLeadJourney({
    now,
    status: source.status,
    qualificationStatus: source.qualification_status,
    corretorId: source.corretor_id,
    assignedAt: source.assigned_at,
    firstContactAt: source.first_contact_at,
    distributionStatus: source.distribution_status,
    hasWhatsapp: !["no_whatsapp_contact", "meta_blocked"].includes(source.qualification_status ?? ""),
    aiFirstContactAt: turboState?.firstContactAt ?? source.first_ai_at,
    lastInboundAt: source.last_inbound_at,
    inboundCount,
    lastAiMessageAt: source.last_ai_at,
    optedOut: Boolean(source.opt_out_at),
    wrongNumber: Boolean(source.wrong_number_at),
    collectedFields: collected,
    cadence: touches.sent > 0 || touches.nextAt ? touches : null,
    recovery: recoveryState(source.recovery),
  });
  return {
    id: source.id,
    name: source.nome?.trim() || "Sem nome",
    phone: source.telefone,
    status: source.status,
    qualificationStatus: source.qualification_status,
    createdAt: iso(source.created_at) ?? new Date(0).toISOString(),
    queueId: source.queue_id,
    queueName: source.queue_name,
    brokerName: source.broker_name,
    livesCount: source.lives_count,
    sourceChannel: source.source_channel,
    field: inboundCount > 0 ? currentField(collected)?.label ?? null : null,
    touches: { sent: touches.sent, total: touches.total },
    lastInboundAt: iso(source.last_inbound_at),
    journey,
  };
}

/** Abas de etapa da tela, na ordem do dia a dia (quem precisa de ação primeiro). */
export const JOURNEY_TABS: ReadonlyArray<{ id: string; label: string; codes: readonly JourneyCode[] }> = [
  { id: "all", label: "Todos", codes: [] },
  { id: "talking", label: "Em conversa", codes: ["Q2", "Q3"] },
  { id: "stopped", label: "Parou no meio", codes: ["R2"] },
  { id: "never", label: "Nunca respondeu", codes: ["R1"] },
  { id: "warm", label: "Mornos", codes: ["R3"] },
  { id: "hot", label: "Quentes", codes: ["Q4", "Q5"] },
  { id: "broker", label: "Com corretor", codes: ["N1", "N2", "N3", "N4", "N5", "N6", "N7"] },
  { id: "queue", label: "Fila de ligação", codes: ["R4", "R5", "R6"] },
  { id: "closed", label: "Não contatar", codes: ["X1", "X2", "SW"] },
];

export function rowsForTab(rows: readonly QualificationLeadRow[], tabId: string) {
  const tab = JOURNEY_TABS.find((item) => item.id === tabId);
  if (!tab || !tab.codes.length) return [...rows];
  return rows.filter((row) => tab.codes.includes(row.journey.code));
}

/**
 * Etapa para listas que não carregam as mensagens (carteira, distribuição): só quando os campos do lead bastam,
 * isto é, com corretor, encerrado, quente ou morno. Sem isso devolve null e a lista mantém a barra antiga.
 */
export function journeyFromLeadFields(lead: { status: string; qualificationStatus?: string | null; corretorId?: string | null; assignedAt?: string | Date | null; firstContactAt?: string | Date | null }, now = new Date()) {
  const qualification = lead.qualificationStatus ?? "pending";
  const known = Boolean(lead.corretorId) || lead.status === "converted" || lead.status === "lost" || ["hot", "qualified", "warm"].includes(qualification);
  if (!known) return null;
  return deriveLeadJourney({ now, status: lead.status, qualificationStatus: qualification, corretorId: lead.corretorId, assignedAt: lead.assignedAt, firstContactAt: lead.firstContactAt });
}
