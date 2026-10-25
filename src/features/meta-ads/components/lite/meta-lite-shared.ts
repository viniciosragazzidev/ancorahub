/**
 * Peças puras das telas Meta no visual Lite (Onda 7): o resumo da última sincronização calculado no servidor (texto
 * pronto, data em pt-BR no fuso de São Paulo) e o mapa de status de veiculação para os tons Lite.
 */
import { formatLiteDate } from "@/components/lite/format/date";
import { summarizeLastSync, type MetaSyncTone } from "../../meta-sync-status";
import type { MetaCampaignItem, MetaSyncLogItem } from "../../types";

export type LiteTone = "success" | "warning" | "danger" | "info" | undefined;

export type MetaSyncInfo = {
  tone: LiteTone;
  label: string;
  detail: string;
  title: string;
  errorDetails: string | null;
};

export function liteToneOf(tone: MetaSyncTone | "outline" | "destructive" | "success" | "warning"): LiteTone {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "destructive") return "danger";
  if (tone === "info") return "info";
  return undefined;
}

/** Mesmo conteúdo do MetaSyncBadge (rótulo, detalhe, motivo da falha com o token redigido), em texto pronto para o cliente. */
export function buildMetaSyncInfo(logs: readonly MetaSyncLogItem[], lastSyncedAt: Date | string | null | undefined, canViewError: boolean, now: Date): MetaSyncInfo {
  const summary = summarizeLastSync(logs, lastSyncedAt, now);
  const latest = [...logs]
    .filter((log) => log.startedAt instanceof Date && !Number.isNaN(log.startedAt.getTime()))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const errorDetails = canViewError && latest?.status === "error" ? latest.errorDetails?.trim() : null;
  return {
    tone: liteToneOf(summary.tone),
    label: summary.label,
    detail: summary.detail,
    title: summary.at ? `Última sincronização: ${formatLiteDate(summary.at, { dateStyle: "short", timeStyle: "short" })}` : "Nenhuma sincronização registrada",
    errorDetails: errorDetails ? errorDetails.replace(/access_token=[^&\s]+/gi, "access_token=[redigido]").slice(0, 320) : null,
  };
}

export function campaignDetailHref(campaign: Pick<MetaCampaignItem, "id" | "campaignId">): string {
  return `/marketing/campanhas/${encodeURIComponent(campaign.id || campaign.campaignId)}`;
}

/** Mesmos rótulos do getCampaignDeliveryState da tela atual. */
export function campaignDelivery(status: string): { label: string; tone: LiteTone } {
  switch (status.trim().toUpperCase()) {
    case "ACTIVE": return { label: "Ativa", tone: "success" };
    case "PAUSED":
    case "CAMPAIGN_PAUSED": return { label: "Pausada", tone: undefined };
    case "ADSET_PAUSED": return { label: "Conjunto pausado", tone: undefined };
    case "ARCHIVED": return { label: "Arquivada", tone: undefined };
    case "DELETED": return { label: "Excluída", tone: "danger" };
    case "DISAPPROVED":
    case "WITH_ISSUES": return { label: "Com problemas", tone: "warning" };
    case "PENDING_REVIEW": return { label: "Em análise", tone: "warning" };
    case "IN_PROCESS": return { label: "Em processamento", tone: "warning" };
    default: return { label: status || "Indisponível", tone: undefined };
  }
}

/** Mesmo texto do formatDistributionDestination da tela atual. */
export function distributionDestination(campaign: MetaCampaignItem): string {
  if (!campaign.isEligibleForCapture || campaign.distributionRule === "none") return "Não distribuído";
  if (campaign.distributionQueueName) return campaign.distributionQueueName;
  if (campaign.distributionRule === "ad") return "Fila padrão (regra do anúncio)";
  if (campaign.distributionRule === "campaign") return "Fila padrão (regra da campanha)";
  return "Fila padrão da distribuição";
}
