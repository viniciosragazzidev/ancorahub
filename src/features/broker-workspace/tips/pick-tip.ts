import type { BrokerWorkspaceActionKind, BrokerWorkspacePriority } from "@/features/broker-workspace/priority";

/** One quick tip that pops up for the broker: what to do now, in one tap. */
export type BrokerTip = {
  /** Stable per lead, kind and day: the same tip never shows twice. */
  id: string;
  leadId: string;
  kind: BrokerWorkspaceActionKind;
  title: string;
  text: string;
  cta: { label: string; href: string };
  tone: "urgent" | "normal";
  /** What is happening now (Vinicios, 18/10: tips more alive and current). */
  live: {
    /** When the thing started (client wrote, lead arrived, return due): the popup counts the time live. */
    at: string;
    /** Other clients waiting for an answer besides this one. */
    othersWaiting: number;
    /** The client's last message, filled by the route. */
    quote?: string | null;
    /** Conversation stage and one practical hint from the AI reading, filled by the route. */
    stage?: string | null;
    insight?: string | null;
  };
};

const TIME_ZONE = "America/Sao_Paulo";
const ORDER: BrokerWorkspaceActionKind[] = ["awaiting_response", "sla_overdue", "sla_risk", "task_overdue", "return_due", "follow_up_stalled", "proposal_pending"];

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function since(at: Date, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function dayKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/**
 * The single most useful tip right now, from the broker's own queue (no AI
 * call): a client waiting for an answer comes first, then a new lead about to
 * miss the first-contact deadline, a return due, a stalled negotiation. When
 * the conversation analysis has a next step, it becomes the tip.
 */
export function pickBrokerTip(input: {
  queue: Array<{ id: string; name: string; nextAction: BrokerWorkspacePriority | null }>;
  /** Next step suggested by the conversation analysis, by lead (already in plain Portuguese). */
  aiStep?: ReadonlyMap<string, string>;
  now: Date;
}): BrokerTip | null {
  const { now } = input;
  const candidates = input.queue
    .filter((lead) => lead.nextAction && ORDER.includes(lead.nextAction.kind))
    .sort((left, right) => ORDER.indexOf(left.nextAction!.kind) - ORDER.indexOf(right.nextAction!.kind)
      || left.nextAction!.referenceAt.getTime() - right.nextAction!.referenceAt.getTime());
  const lead = candidates[0];
  if (!lead?.nextAction) return null;
  const action = lead.nextAction;
  const name = firstName(lead.name);
  const step = input.aiStep?.get(lead.id) ?? null;
  const href = `/leads/${lead.id}`;
  const othersWaiting = candidates.filter((other) => other.id !== lead.id && other.nextAction!.kind === "awaiting_response").length;
  const base = { id: `${action.kind}:${lead.id}:${dayKey(now)}`, leadId: lead.id, kind: action.kind, live: { at: action.referenceAt.toISOString(), othersWaiting } };

  switch (action.kind) {
    case "awaiting_response":
      return { ...base, tone: "urgent", title: `${name} está esperando você`, text: step ? `Dica: ${step}.` : `Escreveu há ${since(action.referenceAt, now)}. Responda agora, mesmo que curto: quem responde rápido vende mais.`, cta: { label: `Responder ${name}`, href } };
    case "sla_overdue":
    case "sla_risk":
      return { ...base, tone: "urgent", title: `Lead novo: ${name}`, text: action.kind === "sla_overdue" ? "O prazo do primeiro contato passou. Um oi rápido no WhatsApp ainda salva o lead." : "O prazo do primeiro contato está acabando. Um oi rápido no WhatsApp já conta.", cta: { label: `Chamar ${name}`, href } };
    case "task_overdue":
    case "return_due":
      return { ...base, tone: action.kind === "task_overdue" ? "urgent" : "normal", title: action.kind === "task_overdue" ? `Retorno atrasado: ${name}` : `Retorno de hoje: ${name}`, text: step ? `Dica: ${step}.` : "Chame no WhatsApp e já combine o próximo passo. Cliente lembrado é cliente quente.", cta: { label: "Abrir o lead", href } };
    case "follow_up_stalled":
      return { ...base, tone: "normal", title: `${name} está parado`, text: step ? `Dica: ${step}.` : "Mande uma retomada leve, tipo: \"Conseguiu dar uma olhada na proposta?\"", cta: { label: "Retomar agora", href } };
    case "proposal_pending":
      return { ...base, tone: "normal", title: `Cotação de ${name}`, text: step ? `Dica: ${step}.` : "A cotação está esperando. Mande agora e combine um horário para tirar dúvidas.", cta: { label: "Abrir o lead", href } };
    default:
      return null;
  }
}
