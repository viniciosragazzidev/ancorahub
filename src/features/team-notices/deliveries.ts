/**
 * "Últimos envios" de um aviso da equipe (DeskComm 7.1, observabilidade do aviso). Cada aviso sai pela fila
 * protegida `whatsapp_outbound_messages` (Meta e WhatsApp da empresa, com o motivo da espera ou da falha), então é
 * ali que se lê o histórico. Puro, sem I/O: transforma a linha da fila no que a gaveta mostra.
 */
import { lastFourDigits } from "@/features/internal-contacts/decision";

import type { TeamNotice } from "./catalog";

export type NoticeDeliverySituation = "sent" | "not_sent" | "queued";

export type NoticeDeliveryView = {
  id: string;
  at: string;
  to: string;
  situation: NoticeDeliverySituation;
  reason: string;
  test: boolean;
};

export type NoticeDeliverySource = {
  id: string;
  status: string;
  deliveryRoute: string;
  destinationPhone: string;
  holdReason: string | null;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
  idempotencyKey: string;
  createdAt: Date;
  sentAt: Date | null;
  failedAt: Date | null;
  nextAttemptAt: Date | null;
};

export const NOTICE_DELIVERY_LIMIT = 30;
export const NOTICE_DELIVERY_WINDOW_DAYS = 30;
export const NOTICE_TEST_PREFIX = "notice-test:";

export const SITUATION_LABEL: Record<NoticeDeliverySituation, string> = {
  sent: "Enviado",
  not_sent: "Não saiu",
  queued: "Na fila",
};

const HOLD_REASON: Record<string, string> = {
  weekend: "Fim de semana. Sai na segunda às 8h.",
  outside_business_hours: "Fora do horário comercial. Sai às 8h.",
  recipient_spacing: "Intervalo entre avisos da mesma pessoa.",
  recipient_hourly_limit: "A pessoa já recebeu o limite da hora.",
  recipient_daily_limit: "A pessoa já recebeu o limite do dia.",
  number_spacing: "Intervalo entre mensagens do WhatsApp da empresa.",
  number_hourly_limit: "O WhatsApp da empresa chegou ao limite da hora.",
  number_daily_limit: "O WhatsApp da empresa chegou ao limite do dia.",
  stale_reminder: "Lembrete ficou velho na fila e foi descartado.",
  duplicate: "Aviso repetido para a mesma pessoa. Descartado.",
  reminder_daily_limit: "A pessoa já recebeu 2 lembretes hoje.",
  disabled: "Aviso desligado na hora do envio.",
  company_number_unavailable: "WhatsApp da empresa fora do ar. Foi pela Meta oficial.",
  company_number_paused: "WhatsApp da empresa pausado. Foi pela Meta oficial.",
  meta_template_missing: "Sem template aprovado na Meta. Foi pelo WhatsApp da empresa.",
  empty_company_text: "Texto vazio no WhatsApp da empresa. Foi pela Meta oficial.",
};

const ROUTE_NOTES = new Set(["company_number_unavailable", "company_number_paused", "meta_template_missing", "empty_company_text"]);

const ERROR_REASON: Record<string, string> = {
  "131026": "O número não tem WhatsApp.",
  "131047": "Fora da janela de 24 horas da Meta.",
  "470": "Fora da janela de 24 horas da Meta.",
  "131049": "A Meta segurou a mensagem para proteger o número.",
  "131056": "Mensagens demais para o mesmo número em pouco tempo.",
  "131051": "Tipo de mensagem que a Meta não aceita.",
  "130472": "O número está num teste da Meta e não recebe.",
  "132000": "As variáveis não batem com o template da Meta.",
  "132001": "O template não existe na Meta.",
  "132015": "O template está pausado na Meta.",
  "132016": "O template foi desativado na Meta.",
  "131031": "A conta da Meta está bloqueada.",
  "190": "O acesso à Meta expirou. Reconecte o número oficial.",
  OFFER_NO_LONGER_ACTIVE: "A oferta já tinha acabado.",
  ASSIGNMENT_SUPERSEDED: "O lead já tinha ido para outra pessoa.",
  DUTY_SHIFT_REMINDER_STALE: "O lembrete passou da hora.",
  STALE_OUTBOX_MESSAGE: "Ficou tempo demais na fila.",
  COMPANY_NUMBER_UNAVAILABLE: "WhatsApp da empresa fora do ar.",
  BROKER_PHONE_UNAVAILABLE: "A pessoa não tem telefone no cadastro.",
  META_CHANNEL_UNAVAILABLE: "Sem número oficial da Meta ativo.",
  META_SOURCE_CHANNEL_UNAVAILABLE: "Sem número oficial da Meta ativo.",
  META_OUTBOUND_FAILED: "A Meta recusou o envio.",
};

export function noticeDeliveryReason(row: Pick<NoticeDeliverySource, "status" | "deliveryRoute" | "holdReason" | "providerErrorCode" | "providerErrorMessage">): string {
  const situation = noticeDeliverySituation(row.status);
  if (situation === "sent") {
    if (row.providerErrorMessage?.startsWith("Meta não enviou")) return "A Meta não enviou. Saiu pelo WhatsApp da empresa.";
    // Só as notas de troca de canal valem para o que saiu; espera de horário ou limite já passou.
    if (row.holdReason && ROUTE_NOTES.has(row.holdReason)) return HOLD_REASON[row.holdReason];
    return row.deliveryRoute === "waha_direct" ? "Pelo WhatsApp da empresa." : "Pela Meta oficial.";
  }
  if (row.providerErrorCode) return ERROR_REASON[row.providerErrorCode] ?? `Falha no envio (código ${row.providerErrorCode}).`;
  if (row.holdReason && HOLD_REASON[row.holdReason] && !ROUTE_NOTES.has(row.holdReason)) return HOLD_REASON[row.holdReason];
  return situation === "queued" ? "Aguardando a vez na fila." : "Não saiu, sem motivo registrado.";
}

export function noticeDeliverySituation(status: string): NoticeDeliverySituation {
  if (status === "sent" || status === "delivered" || status === "read") return "sent";
  if (status === "failed" || status === "skipped") return "not_sent";
  return "queued";
}

export function describeNoticeDelivery(row: NoticeDeliverySource): NoticeDeliveryView {
  const at = row.sentAt ?? row.failedAt ?? row.createdAt;
  return {
    id: row.id,
    at: at.toISOString(),
    to: lastFourDigits(row.destinationPhone),
    situation: noticeDeliverySituation(row.status),
    reason: noticeDeliveryReason(row),
    test: row.idempotencyKey.startsWith(NOTICE_TEST_PREFIX),
  };
}

/** Purposes de um aviso na fila: o principal e os extras do mesmo interruptor. O chat livre sai como `directText`. */
export function noticePurposes(notice: TeamNotice): string[] {
  if (notice.chat) return ["directText"];
  return [notice.purpose, ...(notice.extraPurposes ?? [])];
}

/**
 * Avisos com envio de teste. Fora ficam o chat (texto livre) e os sempre ligados: convite e presença levam um link
 * secreto de verdade, e o lembrete do plantão é montado pela escala; um teste com dado falso só confundiria.
 */
export function noticeTestable(notice: TeamNotice) {
  return !notice.chat && !notice.alwaysOn && !notice.metaOnly;
}

export const MAX_NOTICE_TESTS_PER_HOUR = 3;

/** Quantos testes ainda cabem nesta hora. */
export function remainingNoticeTests(sentInLastHour: number) {
  return Math.max(0, MAX_NOTICE_TESTS_PER_HOUR - sentInLastHour);
}
