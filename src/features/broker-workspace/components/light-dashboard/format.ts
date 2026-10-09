import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

const TIME_ZONE = "America/Sao_Paulo";

/** HH:mm in Sao Paulo time, deterministic on server and client. */
export function formatTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(value));
}

/** "segunda-feira, 12/10" for a yyyy-mm-dd duty date. */
export function formatDutyDay(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(
    new Date(`${dateKey}T12:00:00Z`),
  );
}

/** "2 h 15 min" or "40 min" from milliseconds. */
export function formatRemaining(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Time of an agenda item: "Hoje, 14:00" or "12/10, 09:00"; overdue is told by the chip, not here. */
export function formatAgendaWhen(value: Date | string, now: Date | null) {
  const date = new Date(value);
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
  const time = formatTime(date);
  if (now && dayKey(date) === dayKey(now)) return `Hoje, ${time}`;
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE }).format(date);
  return `${day}, ${time}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** One sentence about the day. A number appears only when there is something to count. */
export function statusSentence(today: BrokerWorkspaceData["today"]) {
  if (today.slaAtRiskNow > 0) return `${plural(today.slaAtRiskNow, "lead com prazo em risco", "leads com prazo em risco")}. Vale olhar primeiro.`;
  if (today.newLeads > 0) return `${plural(today.newLeads, "novo lead aguarda", "novos leads aguardam")} seu aceite.`;
  if (today.awaitingResponse > 0) return `${plural(today.awaitingResponse, "cliente aguarda", "clientes aguardam")} sua resposta.`;
  return "Nenhuma pendência agora.";
}

type ActionKind = NonNullable<BrokerWorkspaceData["nextAction"]>["kind"];
type Tone = "neutral" | "success" | "info" | "warning" | "danger";

export type ActionPresentation = { chip: string; tone: Tone; button: string; href: (leadId: string) => string };

const leadHref = (leadId: string) => (leadId ? `/leads/${leadId}` : "/minha-fila");

export const ACTION_PRESENTATION: Record<ActionKind, ActionPresentation> = {
  awaiting_response: { chip: "Respondeu", tone: "success", button: "Ver conversa", href: (id) => `/conversas/broker?leadId=${id}` },
  sla_overdue: { chip: "Prazo vencido", tone: "warning", button: "Atender agora", href: leadHref },
  sla_risk: { chip: "Prazo em risco", tone: "warning", button: "Atender agora", href: leadHref },
  new_lead: { chip: "Novo lead", tone: "info", button: "Aceitar lead", href: leadHref },
  task_overdue: { chip: "Tarefa atrasada", tone: "warning", button: "Ver tarefa", href: leadHref },
  return_due: { chip: "Retorno hoje", tone: "info", button: "Ver retorno", href: leadHref },
  proposal_pending: { chip: "Cotação", tone: "neutral", button: "Retomar cotação", href: leadHref },
  document_pending: { chip: "Documentos", tone: "neutral", button: "Ver documentos", href: leadHref },
  follow_up_stalled: { chip: "Sem contato", tone: "neutral", button: "Retomar contato", href: leadHref },
};

export const DEFAULT_ACTION: ActionPresentation = { chip: "Ação", tone: "neutral", button: "Ver lead", href: leadHref };
