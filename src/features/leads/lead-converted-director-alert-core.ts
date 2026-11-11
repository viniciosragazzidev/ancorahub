/**
 * "Venda fechada para a direção" (11/11, pedido do Vinicios): quando um lead vira venda (`converted`), os números
 * da direção (a Keyla, na Âncora) recebem no WhatsApp da empresa o cliente, o negócio, o corretor, o tempo no
 * fechamento, como a venda foi confirmada e o que ainda falta no CRM. Uma vez por lead e número, venha a conversão
 * da IA ou de uma pessoa. Regras puras; o disparo recebe as dependências de I/O por parâmetro (testável).
 */
import { SALE_SIGNAL_LABELS, type SaleSignal } from "@/features/conversation-intelligence/sale-detection-core";

import { closingDealLine, formatRecipientPhone } from "./closing-director-alert-core";
import { CLOSING_STAGE_STATUSES } from "./closing-stage-notice-core";

export const LEAD_CONVERTED_DIRECTOR_NOTICE_KEY = "LEAD_CONVERTED_DIRECTOR";
export const LEAD_CONVERTED_DIRECTOR_PURPOSE = "leadConvertedDirectorAlert";

/**
 * Linha omitida no texto. O envio exige variáveis com ao menos 1 caractere, então a ausência viaja como "-"
 * e o texto pronto pula a linha.
 */
export const OMITTED_LINE = "-";

/** Uma vez por lead e número: voltar de Convertido e converter de novo nunca manda outra vez. */
export function leadConvertedDirectorAlertKey(leadId: string, phone: string) {
  return `lead-converted-director:${leadId}:${phone}`;
}

/** "Venda registrada no CRM": a mensagem curta, quando o registro chega depois do aviso da venda. */
export const LEAD_SALE_REGISTERED_DIRECTOR_PURPOSE = "leadSaleRegisteredDirectorAlert";

export function leadSaleRegisteredDirectorAlertKey(leadId: string, phone: string) {
  return `lead-sale-registered-director:${leadId}:${phone}`;
}

/** Variáveis da mensagem curta: cliente, corretor, negócio (com valor e plano registrados) e o id do lead. */
export function leadSaleRegisteredDirectorAlertVariables(input: Pick<LeadConvertedAlertInput, "leadId" | "leadName" | "brokerName" | "leadType" | "livesCount" | "monthlyValue" | "planName">) {
  return [
    clip(input.leadName || "Cliente", 120),
    clip(input.brokerName || "Sem corretor", 120),
    clip(closingDealLine(input), 200),
    input.leadId,
  ];
}

/** Só a primeira entrada em Convertido avisa (re-salvar em Convertido não é venda nova). */
export function becomesConverted(previousStatus: string | null | undefined, newStatus: string) {
  return newStatus === "converted" && previousStatus !== "converted";
}

/** O envio limita cada variável a 512 caracteres. */
function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** "a, b e c" */
export function joinPtBr(items: readonly string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Sinais da IA em texto, na ordem de força do catálogo: "adesão paga, contrato assinado e entrevista ...". */
export function saleSignalsSentence(signals: readonly string[]) {
  const known = (Object.keys(SALE_SIGNAL_LABELS) as SaleSignal[]).filter((signal) => signals.includes(signal));
  return joinPtBr(known.map((signal) => SALE_SIGNAL_LABELS[signal]));
}

/** Tira "Cliente:" / "Corretor:" e as aspas do trecho citado pela IA. */
export function cleanSaleQuote(raw: string | null | undefined) {
  const text = (raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(cliente|corretor|corretora|lead)\s*:\s*/i, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
  return text;
}

export type StageHistoryRow = { fromStatus: string | null; toStatus: string; changedAt: Date };

/**
 * Quando o lead entrou no fechamento antes desta venda: a primeira entrada em Documentação/Em análise da
 * sequência que termina na conversão (passar por Aguardando retorno no meio não interrompe). Sem histórico,
 * usa a entrada na etapa anterior quando ela era do fechamento. Lead que pulou o fechamento: null.
 */
export function closingEnteredAt(input: {
  history: readonly StageHistoryRow[];
  previousStatus: string | null;
  previousStageEnteredAt: Date | null;
}): Date | null {
  const rows = [...input.history].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
  let end = rows.length;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]!.toStatus === "converted") { end = index; break; }
  }
  let entered: Date | null = null;
  for (let index = end - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    if (CLOSING_STAGE_STATUSES.has(row.toStatus)) entered = row.changedAt;
    else if (row.toStatus !== "awaiting_reply") break;
  }
  if (entered) return entered;
  return input.previousStatus && CLOSING_STAGE_STATUSES.has(input.previousStatus) ? input.previousStageEnteredAt : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** "8 dias no fechamento (entrou em 03/11)"; sem a entrada no fechamento, a linha some. */
export function closingTimeLine(enteredAt: Date | null, convertedAt: Date) {
  if (!enteredAt || Number.isNaN(enteredAt.getTime())) return null;
  const days = Math.max(0, Math.floor((convertedAt.getTime() - enteredAt.getTime()) / DAY_MS));
  const label = days === 0 ? "Menos de 1 dia" : days === 1 ? "1 dia" : `${days} dias`;
  return `${label} no fechamento (entrou em ${dayMonth.format(enteredAt)})`;
}

function positive(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

/** O que falta no CRM para a direção conferir: valor, operadora/plano e confirmação da operadora, nessa ordem. */
export function missingInCrm(input: { monthlyValue: string | number | null; hasPlan: boolean; hasOperatorConfirmation: boolean }) {
  const items: string[] = [];
  if (!positive(input.monthlyValue)) items.push("valor");
  if (!input.hasPlan) items.push("operadora/plano");
  if (!input.hasOperatorConfirmation) items.push("confirmação da operadora");
  return items;
}

/** Como a venda chegou a Convertido: a IA viu na conversa, ou uma pessoa registrou. */
export type SaleOrigin =
  | { kind: "ai"; signals: readonly string[]; quote: string | null }
  | { kind: "person"; actorName: string | null };

export type LeadConvertedAlertInput = {
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  leadType: string | null;
  livesCount: number | null;
  monthlyValue: string | number | null;
  planName: string | null;
  brokerName: string | null;
  closingEnteredAt: Date | null;
  convertedAt: Date;
  origin: SaleOrigin;
  hasPlan: boolean;
  hasOperatorConfirmation: boolean;
};

/**
 * Variáveis na ordem do evento `leadConvertedDirectorAlert`: cliente, telefone, negócio, corretor, tempo no
 * fechamento, como foi confirmada (IA), registrada por (pessoa), trecho, o que falta e o id do lead (link).
 * Linha ausente vai como "-". Cada uma cabe nos 512 caracteres do envio.
 */
export function leadConvertedDirectorAlertVariables(input: LeadConvertedAlertInput): string[] {
  const phoneDigits = input.leadPhone?.replace(/\D/g, "") ?? "";
  const ai = input.origin.kind === "ai" ? input.origin : null;
  const person = input.origin.kind === "person" ? input.origin : null;
  const signals = ai ? saleSignalsSentence(ai.signals) : "";
  const quote = ai ? cleanSaleQuote(ai.quote) : "";
  const missing = missingInCrm({ monthlyValue: input.monthlyValue, hasPlan: input.hasPlan, hasOperatorConfirmation: input.hasOperatorConfirmation });
  return [
    clip(input.leadName || "Cliente", 120),
    phoneDigits ? formatRecipientPhone(phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`) : "Sem telefone",
    clip(closingDealLine(input), 200),
    clip(input.brokerName || "Sem corretor", 120),
    closingTimeLine(input.closingEnteredAt, input.convertedAt) ?? OMITTED_LINE,
    ai ? clip(signals ? `${signals}.` : "venda vista pela IA na conversa.", 300) : OMITTED_LINE,
    person ? clip(person.actorName || "Equipe", 120) : OMITTED_LINE,
    quote ? clip(quote, 200) : OMITTED_LINE,
    missing.length ? `${joinPtBr(missing)}.` : OMITTED_LINE,
    input.leadId,
  ];
}

// ─── Disparo (I/O injetado) ───────────────────────────────────────────

export type LeadConvertedTrigger = {
  tenantId: string;
  leadId: string;
  previousStatus: string | null;
  newStatus: string;
  /** Veio do Registrar venda (ou da proposta convertida em venda). */
  registration?: boolean;
};

/**
 * Qual mensagem sai: "sale" (o aviso principal) na primeira entrada em Convertido, venha de onde vier;
 * "registered" (a mensagem curta) quando o Registrar venda acontece com o lead já Convertido, isto é, a venda
 * já tinha sido avisada. Re-salvar Convertido sem registro: nada.
 */
export function directorSaleMessageKind(trigger: Pick<LeadConvertedTrigger, "previousStatus" | "newStatus" | "registration">): DirectorSaleMessageKind | null {
  if (becomesConverted(trigger.previousStatus, trigger.newStatus)) return "sale";
  if (trigger.registration && trigger.newStatus === "converted" && trigger.previousStatus === "converted") return "registered";
  return null;
}

export type DirectorSaleMessageKind = "sale" | "registered";

export function directorSaleMessageKey(kind: DirectorSaleMessageKind, leadId: string, phone: string) {
  return kind === "sale" ? leadConvertedDirectorAlertKey(leadId, phone) : leadSaleRegisteredDirectorAlertKey(leadId, phone);
}

export type LeadConvertedDispatchDeps = {
  /** Números do aviso (com fallback para os do Fechamento para a direção). */
  recipients: () => Promise<string[]>;
  /** Aviso ligado em Avisos da equipe (o mesmo interruptor para as duas mensagens). */
  enabled: () => Promise<boolean>;
  /** Dados do lead já convertidos nas variáveis da mensagem; null quando o lead não existe no tenant. */
  variables: (kind: DirectorSaleMessageKind) => Promise<string[] | null>;
  /** Enfileira e despacha; true só quando saiu uma mensagem nova (chave repetida ou desligado: false). */
  send: (phone: string, kind: DirectorSaleMessageKind, variables: string[], idempotencyKey: string) => Promise<boolean>;
  log?: (event: string, data: Record<string, unknown>) => void;
};

/**
 * Manda a mensagem a cada número configurado, uma vez por lead, mensagem e número. Nunca lança erro: a conversão
 * já está salva. O log leva só o id do lead (sem nome nem telefone).
 */
export async function dispatchLeadConvertedDirectorAlert(trigger: LeadConvertedTrigger, deps: LeadConvertedDispatchDeps) {
  const log = deps.log ?? ((event, data) => console.warn(`[lead-converted-director] ${event}`, data));
  const kind = directorSaleMessageKind(trigger);
  if (!kind) return { notified: 0 };
  try {
    const recipients = await deps.recipients();
    if (!recipients.length) return { notified: 0 };
    if (!(await deps.enabled())) return { notified: 0 };
    const variables = await deps.variables(kind);
    if (!variables) return { notified: 0 };
    const settled = await Promise.allSettled(recipients.map((phone) => deps.send(phone, kind, variables, directorSaleMessageKey(kind, trigger.leadId, phone))));
    let notified = 0;
    for (const item of settled) {
      if (item.status === "fulfilled" && item.value) notified += 1;
      if (item.status === "rejected") log("notice_failed", { leadId: trigger.leadId, error: item.reason instanceof Error ? item.reason.message.slice(0, 200) : "unknown" });
    }
    return { notified };
  } catch (error) {
    log("failed", { leadId: trigger.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { notified: 0 };
  }
}
