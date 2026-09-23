import type { LeadDistributionStatus } from "./types";

/**
 * Mapa ÚNICO de estado de domínio → apresentação da Central de Distribuição.
 *
 * Antes, cada painel decidia sozinho a cor e o texto de um estado (verde aqui,
 * `emerald-500/10` ali, "Ativa" num lugar e "Motor operacional" noutro). Agora
 * um estado tem exatamente uma tradução; os componentes só a consomem.
 *
 * `tone` usa o vocabulário do `DsStatusBadge`/`DsCallout` do design system.
 * Regra do sistema: cor é estado semântico — nunca decoração — e todo estado
 * sai com texto (o badge acrescenta o ponto/ícone).
 */
export type StatusTone = "success" | "warning" | "info" | "destructive" | "secondary";

export type StatusUi = { tone: StatusTone; label: string };

const LEAD_DISTRIBUTION: Record<LeadDistributionStatus, StatusUi> = {
  unassigned: { tone: "warning", label: "Aguardando unidade" },
  awaiting_unit: { tone: "warning", label: "Aguardando unidade" },
  queued: { tone: "warning", label: "Aguardando corretor" },
  returned_to_queue: { tone: "warning", label: "Devolvido à fila" },
  manual_hold: { tone: "secondary", label: "Aguardando ação manual" },
  assigning: { tone: "info", label: "Atribuindo" },
  assigned: { tone: "success", label: "Atribuído" },
  distribution_failed: { tone: "destructive", label: "Falha na distribuição" },
};

export function leadDistributionStatusUi(status: string): StatusUi {
  return LEAD_DISTRIBUTION[status as LeadDistributionStatus] ?? { tone: "secondary", label: "Desconhecido" };
}

export function queueStatusUi(status: string): StatusUi {
  return status === "active"
    ? { tone: "success", label: "Ativa" }
    : { tone: "secondary", label: "Pausada" };
}

const AVAILABILITY: Record<string, StatusUi> = {
  available: { tone: "success", label: "Disponível" },
  paused: { tone: "warning", label: "Em pausa" },
  offline: { tone: "secondary", label: "Offline" },
};

export function availabilityStatusUi(status: string): StatusUi {
  return AVAILABILITY[status] ?? { tone: "secondary", label: "Desconhecido" };
}

export function engineHealthUi(input: { available: boolean; failed: number }): StatusUi {
  if (!input.available) return { tone: "warning", label: "Motor indisponível" };
  if (input.failed > 0) return { tone: "warning", label: "Atenção no motor" };
  return { tone: "success", label: "Motor operacional" };
}

/**
 * Situação do prazo de aceite (SLA). `elapsedMinutes` é o tempo desde a chegada
 * do lead; `limitMinutes` é o limite configurado. Vencendo = a partir de 75%.
 */
export function slaStatusUi(elapsedMinutes: number, limitMinutes: number): StatusUi & { ratio: number } {
  const safeLimit = Math.max(limitMinutes, 1);
  const ratio = Math.max(elapsedMinutes, 0) / safeLimit;
  if (ratio >= 1) return { tone: "destructive", label: "Prazo vencido", ratio };
  if (ratio >= 0.75) return { tone: "warning", label: "Prazo vencendo", ratio };
  return { tone: "success", label: "No prazo", ratio };
}
