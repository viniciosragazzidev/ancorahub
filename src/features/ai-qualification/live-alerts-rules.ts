/**
 * Regras dos alertas calculados na hora (25/11/2026, item AL1 de docs/research/deskcomm-crm-engenharia-reversa.md).
 * Como a "Central de avisos" do DeskComm: cada alerta diz o que aconteceu e o que fazer, e some quando o fato some.
 * Regra pura; quem busca os números é live-alerts.ts.
 */
import type { QualificationAlertRecord } from "./alerts-service";

/** Lead sem corretor há mais que isto vira alerta (o primeiro contato da corretora conta em minutos). */
export const WAITING_LEAD_ALERT_MINUTES = 15;
/** Janela e mínimo de falhas da IA para alertar (uma falha solta é ruído: a próxima tentativa costuma sair). */
export const AI_FAILURE_WINDOW_HOURS = 2;
export const AI_FAILURE_ALERT_MIN = 3;

export type LiveAlertFacts = {
  /** Leads sem corretor esperando há mais de WAITING_LEAD_ALERT_MINUTES. */
  waitingLeads: number;
  /** Desde quando o mais antigo deles espera. */
  oldestWaitingSince: Date | null;
  /** Respostas da IA que falharam na janela. */
  aiFailures: number;
  /** Última falha da IA (texto técnico do provedor). */
  lastAiError: string | null;
  lastAiFailureAt: Date | null;
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function buildLiveAlerts(tenantId: string, facts: LiveAlertFacts): QualificationAlertRecord[] {
  const alerts: QualificationAlertRecord[] = [];
  if (facts.waitingLeads > 0) {
    alerts.push({
      id: "live:queue_no_broker",
      tenantId,
      alertType: "queue_no_broker",
      level: facts.waitingLeads >= 5 ? "critical" : "warning",
      status: "active",
      message: `${facts.waitingLeads === 1 ? "1 lead espera" : `${facts.waitingLeads} leads esperam`} corretor há mais de ${WAITING_LEAD_ALERT_MINUTES} minutos.`,
      suggestedAction: "Confira quem está no plantão e as regras da fila em Distribuição.",
      createdAt: facts.oldestWaitingSince,
      resolvedAt: null,
      resolvedBy: null,
      live: true,
      href: "/distribuicao?view=plantao",
    });
  }
  if (facts.aiFailures >= AI_FAILURE_ALERT_MIN) {
    const detail = facts.lastAiError ? ` Último erro: ${facts.lastAiError.slice(0, 140)}` : "";
    alerts.push({
      id: "live:ai_send_failed",
      tenantId,
      alertType: "ai_send_failed",
      level: "critical",
      status: "active",
      message: `A IA não conseguiu responder ${plural(facts.aiFailures, "vez", "vezes")} nas últimas ${AI_FAILURE_WINDOW_HOURS} horas.${detail}`,
      suggestedAction: "Veja a conexão do WhatsApp e o modelo em Conectividade. Os leads afetados podem ser reabertos em Leads na qualificação.",
      createdAt: facts.lastAiFailureAt,
      resolvedAt: null,
      resolvedBy: null,
      live: true,
      href: "/qualificacao?tab=whatsapp_diag",
    });
  }
  return alerts;
}
