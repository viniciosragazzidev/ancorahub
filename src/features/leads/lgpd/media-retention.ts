/**
 * Retenção de mídia das conversas (LGPD, 26/11/2026). O diretor escolhe por quanto tempo guardar áudio, imagem,
 * vídeo e documento das conversas de leads perdidos ou arquivados: 90 dias, 180 dias, 1 ano, 2 anos ou Sempre
 * (padrão, para nada ser apagado sem decisão). A limpeza apaga só o arquivo do armazenamento; a mensagem fica,
 * com o texto que tinha, e no lugar do arquivo aparece "Mídia removida pela política de retenção".
 *
 * Regra pura (sem banco): é a fonte da verdade do que pode sair. A consulta do job filtra antes no SQL e passa
 * cada linha por aqui de novo; lead convertido, com cliente ou com venda nunca perde mídia.
 *
 * O prazo conta da data mais recente entre a mensagem, a entrada em Perdido e o arquivamento: um lead perdido
 * ontem não perde hoje a mídia que recebeu há dois anos.
 */

export type MediaRetentionOption = "90" | "180" | "365" | "730" | "always";

export const MEDIA_RETENTION_OPTIONS: { value: MediaRetentionOption; days: number | null; label: string }[] = [
  { value: "90", days: 90, label: "90 dias" },
  { value: "180", days: 180, label: "180 dias" },
  { value: "365", days: 365, label: "1 ano" },
  { value: "730", days: 730, label: "2 anos" },
  { value: "always", days: null, label: "Sempre" },
];

export const DEFAULT_MEDIA_RETENTION_OPTION: MediaRetentionOption = "always";
export const MEDIA_RETENTION_REMOVED_TEXT = "Mídia removida pela política de retenção";
const DAY_MS = 24 * 60 * 60 * 1000;

export type MediaRetentionPolicy = {
  option: MediaRetentionOption;
  /** Quem escolheu: a auditoria da limpeza sai no nome dessa pessoa. */
  updatedBy: string | null;
  updatedAt: string | null;
};

export const DEFAULT_MEDIA_RETENTION_POLICY: MediaRetentionPolicy = { option: DEFAULT_MEDIA_RETENTION_OPTION, updatedBy: null, updatedAt: null };

export function mediaRetentionKey(tenantId: string) {
  return `media_retention:${tenantId}`;
}

export const MEDIA_RETENTION_KEY_PREFIX = "media_retention:";

export function parseMediaRetentionOption(value: unknown): MediaRetentionOption | null {
  return MEDIA_RETENTION_OPTIONS.some((option) => option.value === value) ? (value as MediaRetentionOption) : null;
}

export function mediaRetentionDays(option: MediaRetentionOption): number | null {
  return MEDIA_RETENTION_OPTIONS.find((item) => item.value === option)?.days ?? null;
}

export function mediaRetentionLabel(option: MediaRetentionOption) {
  return MEDIA_RETENTION_OPTIONS.find((item) => item.value === option)?.label ?? "Sempre";
}

export function parseMediaRetentionPolicy(raw: string | null | undefined): MediaRetentionPolicy {
  if (!raw) return DEFAULT_MEDIA_RETENTION_POLICY;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const option = parseMediaRetentionOption(value.option);
    if (!option) return DEFAULT_MEDIA_RETENTION_POLICY;
    return {
      option,
      updatedBy: typeof value.updatedBy === "string" ? value.updatedBy : null,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    };
  } catch {
    return DEFAULT_MEDIA_RETENTION_POLICY;
  }
}

export function serializeMediaRetentionPolicy(policy: MediaRetentionPolicy) {
  return JSON.stringify(policy);
}

/** O que passou deste instante (data de referência anterior) já venceu. Sempre: nada vence. */
export function mediaRetentionCutoff(option: MediaRetentionOption, now: Date): Date | null {
  const days = mediaRetentionDays(option);
  return days === null ? null : new Date(now.getTime() - days * DAY_MS);
}

export type MediaRetentionLead = {
  status: string;
  archivedAt: Date | null;
  /** Entrada na etapa atual: para Perdido, é quando o lead foi perdido. */
  stageEnteredAt: Date | null;
  hasClient: boolean;
  hasSale: boolean;
};

export type MediaRetentionCandidate = {
  messageId: string;
  storageKey: string | null;
  sentAt: Date;
  /** Mensagem de cliente (pós-venda) nunca entra, mesmo que o lead pareça perdido. */
  clientId: string | null;
  lead: MediaRetentionLead;
};

/** Só lead perdido ou arquivado, nunca convertido, com cliente ou com venda. */
export function isLeadMediaRetentionEligible(lead: MediaRetentionLead) {
  if (lead.status === "converted" || lead.hasClient || lead.hasSale) return false;
  return lead.status === "lost" || Boolean(lead.archivedAt);
}

/** A data mais recente entre a mensagem, a perda e o arquivamento. */
export function mediaRetentionReferenceDate(candidate: Pick<MediaRetentionCandidate, "sentAt" | "lead">): Date {
  const dates = [candidate.sentAt.getTime()];
  if (candidate.lead.status === "lost" && candidate.lead.stageEnteredAt) dates.push(candidate.lead.stageEnteredAt.getTime());
  if (candidate.lead.archivedAt) dates.push(candidate.lead.archivedAt.getTime());
  return new Date(Math.max(...dates));
}

/** Idempotente: sem arquivo guardado (já removido), a mensagem não entra de novo. */
export function isMediaExpired(candidate: MediaRetentionCandidate, option: MediaRetentionOption, now: Date) {
  const cutoff = mediaRetentionCutoff(option, now);
  if (!cutoff || !candidate.storageKey || candidate.clientId) return false;
  if (!isLeadMediaRetentionEligible(candidate.lead)) return false;
  return mediaRetentionReferenceDate(candidate).getTime() < cutoff.getTime();
}

export function selectExpiredMedia<T extends MediaRetentionCandidate>(candidates: T[], option: MediaRetentionOption, now: Date): T[] {
  return candidates.filter((candidate) => isMediaExpired(candidate, option, now));
}

const PLACEHOLDER = /^\[(image|document|audio|video|sticker|unsupported)\]$/i;

/**
 * O texto da mensagem depois da limpeza: legenda ou transcrição ficam, e o aviso entra no lugar do arquivo.
 * Rodar de novo não repete o aviso.
 */
export function removedMediaBody(body: string | null | undefined): string {
  const text = (body ?? "").trim();
  if (!text || PLACEHOLDER.test(text)) return MEDIA_RETENTION_REMOVED_TEXT;
  if (text.endsWith(MEDIA_RETENTION_REMOVED_TEXT)) return text;
  return `${text}\n\n${MEDIA_RETENTION_REMOVED_TEXT}`;
}

/** "Próxima limpeza remove cerca de N arquivos" (ou o aviso de que nada sai). */
export function describeMediaRetentionPreview(option: MediaRetentionOption, count: number | null): string {
  if (option === "always") return "Nenhuma mídia é apagada.";
  if (count === null) return "Não deu para contar os arquivos agora.";
  if (count === 0) return "Próxima limpeza não remove nenhum arquivo.";
  return `Próxima limpeza remove cerca de ${count.toLocaleString("pt-BR")} ${count === 1 ? "arquivo" : "arquivos"}.`;
}
