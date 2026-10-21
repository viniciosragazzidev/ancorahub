import type { BrokerJourneyData } from "@/features/engagement/journey-types";
import type { BrokerWorkspacePriority } from "@/features/broker-workspace/priority";

export type NextAction = {
  label: string;
  detail: string;
  href: string;
  urgent: boolean;
  /** A new lead waiting for acceptance: the button accepts it right there (and pulses). */
  acceptLeadId?: string;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function minutesSince(date: Date, now: Date) {
  const minutes = Math.max(1, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `há ${hours} h` : `há ${Math.round(hours / 24)} ${Math.round(hours / 24) === 1 ? "dia" : "dias"}`;
}

/**
 * "A próxima coisa é" of the broker's Início (plan §5, E5): the server's top
 * priority (it already orders SLA, replies, returns, documents, quotes), then a
 * mission one step from done. Null when everything is in order.
 */
export function nextActionOf(priority: BrokerWorkspacePriority | null, journey: BrokerJourneyData | null, now = new Date()): NextAction | null {
  if (priority) {
    const name = firstName(priority.title);
    const since = minutesSince(priority.referenceAt, now);
    const urgent = priority.severity === "critical";
    switch (priority.kind) {
      case "sla_overdue": return { label: `Atender ${name}`, detail: `O prazo do primeiro contato já passou (${since}).`, href: priority.href, urgent: true };
      case "sla_risk": return { label: `Atender ${name}`, detail: `O prazo do primeiro contato está acabando.`, href: priority.href, urgent: true };
      case "awaiting_response": return { label: `Responder ${name}`, detail: `Está esperando sua resposta ${since}.`, href: priority.href, urgent };
      case "task_overdue": return { label: priority.title, detail: "Esse retorno já passou do horário.", href: priority.href, urgent: true };
      case "return_due": return { label: priority.title, detail: "Está na hora deste retorno.", href: priority.href, urgent };
      case "new_lead": return { label: "Aceitar e chamar no WhatsApp", detail: `${name} chegou para você. Um toque aceita e já abre o WhatsApp dele.`, href: priority.href, urgent: true, acceptLeadId: priority.leadId };
      case "proposal_pending": return { label: `Retomar a cotação de ${name}`, detail: priority.description, href: priority.href, urgent };
      case "document_pending": return { label: `Documentos de ${name}`, detail: priority.description, href: priority.href, urgent };
      default: return { label: `Retomar ${name}`, detail: priority.description, href: priority.href, urgent };
    }
  }
  const almost = journey?.missions
    .filter((mission) => mission.progress.eligible && !mission.progress.completed && mission.progress.remaining > 0 && mission.progress.remaining <= 1)
    .sort((a, b) => b.bonusPoints - a.bonusPoints)[0];
  if (almost) return { label: "Fechar a missão", detail: `Falta 1 para "${almost.title}" (+${almost.bonusPoints} pts).`, href: "/jornada", urgent: false };
  return null;
}
