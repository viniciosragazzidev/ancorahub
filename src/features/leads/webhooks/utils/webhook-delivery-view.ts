/**
 * Como a tela "Recebidos" das fontes de captura lê cada linha de `webhook_deliveries`. Puro, sem banco: recebe
 * `now` para ser testável.
 *
 * O recebedor grava (receive-lead-webhook.ts e create-lead-from-webhook-sync.ts):
 * - `rejected` com INVALID_PAYLOAD, IDEMPOTENCY_CONFLICT ou BRANCH_NOT_FOUND;
 * - `received` ao reservar a entrega e `processed` com o lead quando o lead entra;
 * - `processed` apontando para um lead que já existia quando o contato chega de novo (reentrada).
 * Duplicado por chave de envio repetida não grava linha nova: a primeira entrega já mostra o lead.
 */
import { formatRelativeTime } from "@/features/meta-ads/meta-sync-status";

export type WebhookDeliverySituation = "entered" | "not_entered" | "duplicate";

export const WEBHOOK_DELIVERY_SITUATION_LABEL: Record<WebhookDeliverySituation, string> = {
  entered: "Entrou",
  not_entered: "Não entrou",
  duplicate: "Duplicado",
};

const REASON_BY_CODE: Record<string, string> = {
  INVALID_PAYLOAD: "Dados incompletos ou inválidos, como nome ou telefone",
  INVALID_JSON: "O envio não veio em formato válido",
  BRANCH_NOT_FOUND: "Nenhuma filial ou fila ativa para receber o lead",
  IDEMPOTENCY_CONFLICT: "Mesmo código de envio com dados diferentes",
  UNAUTHORIZED: "Token inválido ou revogado",
  TENANT_INACTIVE: "Empresa inativa no sistema",
  PAYLOAD_TOO_LARGE: "Envio grande demais",
  RATE_LIMITED: "Muitos envios em pouco tempo",
  INTERNAL_ERROR: "Erro interno ao criar o lead",
};

export const WEBHOOK_REASON_FALLBACK = "Motivo não informado";

/** Depois disso uma entrega que ficou em `received` é tratada como parada, não como em andamento. */
export const WEBHOOK_STUCK_AFTER_MS = 5 * 60 * 1000;
/** Folga entre o relógio do app (receivedAt) e o do banco (createdAt do lead) antes de chamar de duplicado. */
const CLOCK_MARGIN_MS = 60 * 1000;

/** Traduz o errorCode gravado pelo recebedor. Código vazio ou desconhecido cai em "Motivo não informado". */
export function translateWebhookErrorCode(code: string | null | undefined): string {
  if (!code) return WEBHOOK_REASON_FALLBACK;
  return REASON_BY_CODE[code.trim().toUpperCase()] ?? WEBHOOK_REASON_FALLBACK;
}

export type WebhookDeliveryRow = {
  status: string;
  errorCode: string | null;
  leadId: string | null;
  receivedAt: Date;
  /** Criação do lead ligado à entrega; anterior ao recebimento quer dizer que o lead já existia. */
  leadCreatedAt: Date | null;
};

export type WebhookDeliveryView = {
  situation: WebhookDeliverySituation;
  /** Motivo curto em português; null quando o lead entrou normalmente. */
  reason: string | null;
  /** Só com lead ligado à entrega. */
  leadId: string | null;
};

export function describeWebhookDelivery(row: WebhookDeliveryRow, now: Date = new Date()): WebhookDeliveryView {
  if (row.status === "processed") {
    const existed = row.leadCreatedAt !== null && row.leadCreatedAt.getTime() < row.receivedAt.getTime() - CLOCK_MARGIN_MS;
    if (existed) return { situation: "duplicate", reason: "O contato já era um lead e voltou a chegar", leadId: row.leadId };
    return { situation: "entered", reason: null, leadId: row.leadId };
  }
  if (row.status === "received") {
    const stuck = now.getTime() - row.receivedAt.getTime() > WEBHOOK_STUCK_AFTER_MS;
    return { situation: "not_entered", reason: stuck ? "O processamento parou antes de criar o lead" : "Ainda em processamento", leadId: null };
  }
  return { situation: "not_entered", reason: translateWebhookErrorCode(row.errorCode), leadId: row.leadId };
}

/** "Último recebimento há 5 min." ou "Nunca recebeu". */
export function formatLastReceived(lastReceivedAt: Date | null | undefined, now: Date = new Date()): string {
  if (!lastReceivedAt) return "Nunca recebeu";
  const relative = formatRelativeTime(lastReceivedAt, now);
  return relative === "agora" ? "Último recebimento agora" : `Último recebimento ${relative}`;
}
