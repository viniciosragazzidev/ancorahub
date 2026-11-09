/**
 * Reenvio das pesquisas que falharam numa campanha manual de pós-venda (09/11).
 * Regras puras: o que conta como falha reenviável, a chave nova do outbox por tentativa e os
 * contadores do card "Campanhas recentes". O serviço (`campaign-retry-service.ts`) aplica no banco.
 */

/** Estados terminais do outbox em que a abertura não saiu. */
export const POST_SALE_FAILED_OUTBOUND_STATUSES = ["failed", "cancelled", "expired"] as const;
const TERMINAL_OUTBOUND_STATUSES: readonly string[] = [...POST_SALE_FAILED_OUTBOUND_STATUSES, "skipped"];

/** Estados em que a abertura saiu de verdade (contam como "enviadas"). */
export const POST_SALE_DELIVERED_SURVEY_STATUSES = ["sent", "answering", "completed", "no_reply", "opted_out"] as const;

export type PostSaleRetrySurvey = {
  status: string;
  skipReason: string | null;
  outboundStatus: string | null;
  step: number;
  hasReply: boolean;
  completed: boolean;
  /** O lead já entrou numa pesquisa mais nova (outra campanha): o reenvio fica com ela, não com esta. */
  superseded?: boolean;
};

export type PostSaleRetryKind = "failed" | "skipped_channel";

/**
 * Motivo de pulo que é do canal ou do template (pode ter sido corrigido fora do CRM), e não uma
 * proteção do cliente. Os textos vêm do início da campanha e do outbox.
 */
export function isChannelSkipReason(reason: string | null | undefined) {
  const text = (reason ?? "").toLocaleLowerCase("pt-BR");
  if (!text) return false;
  return text.includes("origem indisponível")
    || text.includes("template")
    || text.includes("canal meta")
    || text.includes("canal de origem");
}

function outboundDidNotGoOut(status: string | null) {
  return status === null || TERMINAL_OUTBOUND_STATUSES.includes(status);
}

/**
 * A abertura foi aceita pela Meta mas o webhook devolveu falha (ex.: 131042, pagamento da WABA):
 * a pesquisa ficou "sent" com o outbox "failed". Sem resposta do cliente, é uma falha de envio.
 */
export function isSentButOutboundFailed(survey: PostSaleRetrySurvey) {
  return survey.status === "sent"
    && survey.step === 0
    && !survey.hasReply
    && !survey.completed
    && (POST_SALE_FAILED_OUTBOUND_STATUSES as readonly string[]).includes(survey.outboundStatus ?? "");
}

/** Se a pesquisa pode ser reenviada e por qual motivo. Nunca reenvia quem já respondeu ou recebeu. */
export function classifyPostSaleRetry(survey: PostSaleRetrySurvey): PostSaleRetryKind | null {
  if (survey.hasReply || survey.completed || survey.superseded) return null;
  if (isSentButOutboundFailed(survey)) return "failed";
  if (!outboundDidNotGoOut(survey.outboundStatus)) return null;
  if (survey.status === "failed") return "failed";
  if (survey.status === "skipped" && isChannelSkipReason(survey.skipReason)) return "skipped_channel";
  return null;
}

export type PostSaleCampaignBucket = "sent" | "failed" | "skipped" | "queued" | "other";

/** Em qual contador do card a pesquisa entra. */
export function postSaleCampaignBucket(survey: PostSaleRetrySurvey): PostSaleCampaignBucket {
  if (isSentButOutboundFailed(survey)) return "failed";
  if ((POST_SALE_DELIVERED_SURVEY_STATUSES as readonly string[]).includes(survey.status)) return "sent";
  if (survey.status === "failed") return "failed";
  if (survey.status === "skipped") return "skipped";
  if (survey.status === "queued") return "queued";
  return "other";
}

export type PostSaleCampaignCounts = { sent: number; failed: number; skipped: number; queued: number; retryable: number };

export function emptyPostSaleCampaignCounts(): PostSaleCampaignCounts {
  return { sent: 0, failed: 0, skipped: 0, queued: 0, retryable: 0 };
}

/** Soma linhas agrupadas (com `count`) nos contadores de uma campanha. */
export function summarizePostSaleCampaignSurveys(rows: ReadonlyArray<PostSaleRetrySurvey & { count?: number }>): PostSaleCampaignCounts {
  const counts = emptyPostSaleCampaignCounts();
  for (const row of rows) {
    const n = row.count ?? 1;
    const bucket = postSaleCampaignBucket(row);
    if (bucket !== "other") counts[bucket] += n;
    if (classifyPostSaleRetry(row)) counts.retryable += n;
  }
  return counts;
}

/** Prefixo das chaves de reenvio de uma pesquisa (mantém `post-sale:<campanha>:<lead>` que o outbox lê). */
export function postSaleRetryKeyPrefix(campaignId: string, leadId: string) {
  return `post-sale:${campaignId}:${leadId}:retry:`;
}

/** Chave nova por tentativa: o outbox não devolve a linha antiga que falhou. */
export function postSaleRetryIdempotencyKey(campaignId: string, leadId: string, attempt: number) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Tentativa de reenvio inválida.");
  return `${postSaleRetryKeyPrefix(campaignId, leadId)}${attempt}`;
}

/** Próxima tentativa a partir das chaves que já existem no outbox para esta pesquisa. */
export function nextPostSaleRetryAttempt(existingKeys: readonly string[], campaignId: string, leadId: string) {
  const prefix = postSaleRetryKeyPrefix(campaignId, leadId);
  let max = 0;
  for (const key of existingKeys) {
    if (!key.startsWith(prefix)) continue;
    const attempt = Number(key.slice(prefix.length));
    if (Number.isInteger(attempt) && attempt > max) max = attempt;
  }
  return max + 1;
}

export type PostSaleRetryResult = {
  requeued: number;
  failed: number;
  stillSkipped: Record<string, number>;
};

/** Mensagem curta do resultado para o card. */
export function describePostSaleRetryResult(result: PostSaleRetryResult) {
  const parts = [`${result.requeued} ${result.requeued === 1 ? "pesquisa voltou" : "pesquisas voltaram"} para a fila`];
  if (result.failed) parts.push(`${result.failed} ${result.failed === 1 ? "falhou de novo" : "falharam de novo"}`);
  const skipped = Object.entries(result.stillSkipped).filter(([, count]) => count > 0);
  if (skipped.length) parts.push(`Continuam fora: ${skipped.map(([reason, count]) => `${count} ${reason}`).join("; ")}`);
  return `${parts.join(". ")}.`;
}
