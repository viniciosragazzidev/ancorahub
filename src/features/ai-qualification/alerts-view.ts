/**
 * Alertas da IA na tela /ia/alertas (25/11/2026): regra pura de apresentação. Gravidade sempre com texto, título
 * curto por tipo, abas Abertos e Resolvidos, e o "O que fazer" de cada alerta.
 */
import type { QualificationAlertRecord } from "./alerts-service";

export type AlertRow = {
  id: string;
  alertType: string;
  level: "info" | "warning" | "critical";
  status: "active" | "acknowledged" | "resolved";
  message: string;
  suggestedAction: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  live: boolean;
  href: string | null;
};

const LEVEL_VIEW: Record<AlertRow["level"], { label: string; tone: "danger" | "warning" | undefined }> = {
  critical: { label: "Crítico", tone: "danger" },
  warning: { label: "Atenção", tone: "warning" },
  info: { label: "Informação", tone: undefined },
};

const ALERT_TITLE: Record<string, string> = {
  queue_no_broker: "Lead sem corretor",
  ai_send_failed: "IA sem conseguir responder",
  qualified_without_routing: "Qualificado sem fila",
  whatsapp_latency_spike: "WhatsApp lento",
};

/** Ordem de gravidade: crítico primeiro. */
const LEVEL_ORDER: Record<AlertRow["level"], number> = { critical: 0, warning: 1, info: 2 };

export function alertLevelView(level: string) {
  return LEVEL_VIEW[level as AlertRow["level"]] ?? LEVEL_VIEW.info;
}

export function alertTitle(alertType: string) {
  return ALERT_TITLE[alertType] ?? "Alerta da operação";
}

/** "O que fazer": a sugestão gravada ou, sem ela, uma orientação geral. */
export function alertWhatToDo(alert: Pick<AlertRow, "suggestedAction" | "live">) {
  if (alert.suggestedAction?.trim()) return alert.suggestedAction.trim();
  return alert.live ? "Abra a tela indicada e resolva a causa. O alerta some sozinho quando o problema acabar." : "Confira a causa e marque como resolvido quando tratar.";
}

export function toAlertRow(alert: QualificationAlertRecord): AlertRow {
  return {
    id: alert.id,
    alertType: alert.alertType,
    level: alert.level,
    status: alert.status,
    message: alert.message,
    suggestedAction: alert.suggestedAction,
    createdAt: alert.createdAt ? new Date(alert.createdAt).toISOString() : null,
    resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt).toISOString() : null,
    live: Boolean(alert.live),
    href: alert.href ?? null,
  };
}

export type AlertTab = "open" | "resolved";

export function isOpenAlert(alert: Pick<AlertRow, "status">) {
  return alert.status === "active";
}

/** Linhas da aba: abertos por gravidade e depois os mais recentes; resolvidos pelos resolvidos por último. */
export function alertsForTab(rows: AlertRow[], tab: AlertTab) {
  const time = (value: string | null) => (value ? new Date(value).getTime() : 0);
  if (tab === "open") {
    return rows.filter(isOpenAlert).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || time(b.createdAt) - time(a.createdAt));
  }
  return rows.filter((row) => !isOpenAlert(row)).sort((a, b) => time(b.resolvedAt ?? b.createdAt) - time(a.resolvedAt ?? a.createdAt));
}

/** Só alerta gravado e aberto se resolve à mão; o calculado some sozinho. */
export function canResolveAlert(alert: Pick<AlertRow, "status" | "live">) {
  return alert.status === "active" && !alert.live;
}
