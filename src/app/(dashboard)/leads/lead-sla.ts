/**
 * Prazo (SLA) do cartão do kanban: 1º contato para novos e distribuídos sem contato; tempo na etapa para as etapas
 * ativas. Compartilhado pelo kanban atual e pelo Lite; `labelOf` deixa o Lite usar os rótulos em sentence case.
 */
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

function statusLabel(status: string) {
  return (LEAD_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export type SlaInfo = {
  ratio: number;
  label: string;
  title: string;
  deadline: string;
} | null;

export function computeSlaInfo(
  lead: {
    status: string;
    createdAt: string;
    assignedAt?: string | null;
    stageEnteredAt?: string | null;
    serviceStartedAt?: string | null;
    firstContactAt?: string | null;
    corretorId?: string | null;
  },
  slaFirstContactMinutes: number,
  slaStagnantDays: number,
  labelOf: (status: string) => string = statusLabel,
): SlaInfo {
  const now = Date.now();
  const fmtTime = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(ms));
  const fmtDate = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(ms));

  // New or distributed without first contact → first-contact SLA
  if ((lead.status === "new" || lead.status === "distributed") && !lead.firstContactAt) {
    const anchor = lead.assignedAt || lead.createdAt;
    if (!anchor) return null;
    const anchorMs = new Date(anchor).getTime();
    const elapsed = now - anchorMs;
    const total = slaFirstContactMinutes * 60_000;
    const ratio = Math.min(elapsed / total, 2);
    const remaining = Math.max(0, total - elapsed);
    const deadlineMs = anchorMs + total;

    let label: string;
    if (elapsed >= total) {
      const over = Math.round((elapsed - total) / 60000);
      label = over >= 60 ? `${Math.round(over / 60)}h atrasado` : `${over}min atrasado`;
    } else if (remaining >= 3600000) {
      label = `${Math.round(remaining / 3600000)}h restantes`;
    } else {
      label = `${Math.round(remaining / 60000)}min restantes`;
    }

    return {
      ratio,
      label,
      title: "Prazo de 1º contato",
      deadline: `Limite: ${fmtTime(deadlineMs)} (${slaFirstContactMinutes}min)`,
    };
  }

  // Active stages → stagnation SLA
  const activeStatuses: readonly string[] = ["in_contact", "quote_sent", "negotiation"];
  if (activeStatuses.includes(lead.status) && lead.stageEnteredAt) {
    const stageMs = new Date(lead.stageEnteredAt).getTime();
    const elapsed = now - stageMs;
    const total = slaStagnantDays * 24 * 60 * 60_000;
    const ratio = Math.min(elapsed / total, 2);
    const remaining = Math.max(0, total - elapsed);
    const deadlineMs = stageMs + total;

    let label: string;
    if (elapsed >= total) {
      const over = Math.round(elapsed / 86400000 - slaStagnantDays);
      label = `${over}d atrasado`;
    } else if (remaining >= 86400000) {
      label = `${Math.round(remaining / 86400000)}d restantes`;
    } else {
      label = `${Math.round(remaining / 3600000)}h restantes`;
    }

    return {
      ratio,
      label,
      title: `Tempo na etapa (${labelOf(lead.status)})`,
      deadline: `Limite: ${fmtDate(deadlineMs)} (${slaStagnantDays}d)`,
    };
  }

  return null;
}
