/**
 * Regras puras das propostas (sem banco): padrões da corretora, mensagem do WhatsApp e ordem por atenção.
 * Datas no fuso de São Paulo, o mesmo das telas Lite.
 */
import type { ProposalStatus } from "@/shared/db/schema";

export const PROPOSAL_TIME_ZONE = "America/Sao_Paulo";
/** Validade usada quando a corretora ainda não configurou a sua. */
export const DEFAULT_PROPOSAL_VALID_DAYS = 7;
export const MIN_PROPOSAL_VALID_DAYS = 1;
export const MAX_PROPOSAL_VALID_DAYS = 90;
export const MAX_PROPOSAL_CONDITIONS_LENGTH = 1000;
/** Expira em até 3 dias: pede ação e sobe na lista. */
export const PROPOSAL_URGENT_DAYS = 3;
/** "Esta semana" do resumo: os próximos 7 dias. */
export const PROPOSAL_WEEK_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ProposalDefaults = { validDays: number; conditions: string };

/** Chaves por empresa em system_settings (mesmo padrão de `meta_lead_capture_mode_<tenant>`). */
export function proposalDefaultsKeys(tenantId: string) {
  return {
    validDays: `proposals_default_valid_days_${tenantId}`,
    conditions: `proposals_default_conditions_${tenantId}`,
  };
}

/** Dias de validade válidos (inteiro de 1 a 90) ou null. */
export function parseProposalValidDays(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,3}$/.test(text)) return null;
  const days = Number(text);
  return days >= MIN_PROPOSAL_VALID_DAYS && days <= MAX_PROPOSAL_VALID_DAYS ? days : null;
}

export function resolveProposalDefaults(stored: { validDays?: string | null; conditions?: string | null }): ProposalDefaults {
  return {
    validDays: parseProposalValidDays(stored.validDays) ?? DEFAULT_PROPOSAL_VALID_DAYS,
    conditions: (stored.conditions ?? "").trim().slice(0, MAX_PROPOSAL_CONDITIONS_LENGTH),
  };
}

/** "AAAA-MM-DD" do dia em São Paulo. */
export function saoPauloDateInput(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PROPOSAL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Valor do campo de validade já preenchido: hoje (em São Paulo) mais os dias padrão da corretora. */
export function defaultValidUntilInput(validDays: number, now: Date = new Date()): string {
  const days = parseProposalValidDays(validDays) ?? DEFAULT_PROPOSAL_VALID_DAYS;
  const [year, month, day] = saoPauloDateInput(now).split("-").map(Number);
  const target = new Date(Date.UTC(year!, month! - 1, day! + days, 12));
  return target.toISOString().slice(0, 10);
}

/**
 * Data do campo ("AAAA-MM-DD") para o fim daquele dia em São Paulo. Antes ia para a meia-noite UTC, que em
 * São Paulo é a noite do dia anterior: a proposta aparecia vencendo um dia antes do combinado.
 */
export function validUntilFromDateInput(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59-03:00`);
  if (Number.isNaN(date.getTime()) || saoPauloDateInput(date) !== value) return null;
  return date;
}

/** Link público da proposta: o PDF da cotação vinculada. Sem cotação, não há link público. */
export function proposalPublicPath(publicToken: string | null | undefined): string | null {
  return publicToken ? `/api/quotes/${encodeURIComponent(publicToken)}/pdf` : null;
}

/** Só rascunho e enviada vão pelo WhatsApp: as outras já estão com o cliente ou encerradas. */
export function canSendProposalOnWhatsApp(status: ProposalStatus): boolean {
  return status === "rascunho" || status === "enviada";
}

export function leadFirstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1);
}

/** "Olá Ana, segue sua proposta do plano Amil S380, válida até 30/11." e o link na linha de baixo. */
export function buildProposalWhatsAppMessage(input: { leadName: string | null | undefined; planName?: string | null; validUntil: Date; link: string }): string {
  const name = leadFirstName(input.leadName);
  const plan = input.planName?.trim();
  const validUntil = new Intl.DateTimeFormat("pt-BR", { timeZone: PROPOSAL_TIME_ZONE, day: "2-digit", month: "2-digit" }).format(input.validUntil);
  const greeting = name ? `Olá ${name}` : "Olá";
  const subject = plan ? `segue sua proposta do plano ${plan}` : "segue sua proposta";
  return `${greeting}, ${subject}, válida até ${validUntil}.\n${input.link}`;
}

const OPEN_STATUSES: ReadonlySet<ProposalStatus> = new Set(["rascunho", "em_revisao", "enviada", "visualizada", "negociacao"]);

type AttentionInput = { status: ProposalStatus; validUntil: Date | string };

function expiresWithin(proposal: AttentionInput, days: number, now: Date) {
  if (!OPEN_STATUSES.has(proposal.status)) return false;
  const until = new Date(proposal.validUntil).getTime();
  return until >= now.getTime() && until <= now.getTime() + days * DAY_MS;
}

/** O que pede ação: em revisão, ou aberta que expira em até 3 dias. */
export function proposalAttention(proposal: AttentionInput, now: Date = new Date()): "review" | "expiring" | null {
  if (proposal.status === "em_revisao") return "review";
  if (expiresWithin(proposal, PROPOSAL_URGENT_DAYS, now)) return "expiring";
  return null;
}

/** Em revisão primeiro, depois as que expiram em até 3 dias (a mais próxima antes); o resto mantém a ordem. */
export function sortProposalsByAttention<T extends AttentionInput>(proposals: readonly T[], now: Date = new Date()): T[] {
  const rank = (proposal: T) => {
    const attention = proposalAttention(proposal, now);
    return attention === "review" ? 0 : attention === "expiring" ? 1 : 2;
  };
  return proposals
    .map((proposal, index) => ({ proposal, index, rank: rank(proposal), until: new Date(proposal.validUntil).getTime() }))
    .sort((a, b) => a.rank - b.rank || (a.rank < 2 ? a.until - b.until : 0) || a.index - b.index)
    .map((item) => item.proposal);
}

/** Resumo do topo: "1 em revisão e 2 expiram esta semana". Nada pedindo ação, null. */
export function summarizeProposalAttention(proposals: readonly AttentionInput[], now: Date = new Date()): string | null {
  const inReview = proposals.filter((proposal) => proposal.status === "em_revisao").length;
  const expiringWeek = proposals.filter((proposal) => expiresWithin(proposal, PROPOSAL_WEEK_DAYS, now)).length;
  const parts: string[] = [];
  if (inReview) parts.push(`${inReview} em revisão`);
  if (expiringWeek) parts.push(`${expiringWeek} ${expiringWeek === 1 ? "expira" : "expiram"} esta semana`);
  return parts.length ? parts.join(" e ") : null;
}
