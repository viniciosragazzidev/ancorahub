import { nextStepText } from "./intelligence";

const TIME_ZONE = "America/Sao_Paulo";

/** The arrival of a lead: when it reached the broker, and whether that is today (Vinicios, 17/10). */
export type ArrivalView = { text: string; stale: boolean };

/** The one step the viewer has to take now, in plain words. "none" when there is nothing to do. */
export type NextStepKind = "accept" | "whatsapp" | "reply" | "schedule" | "wait" | "closed" | "none";
export type NextStep = { kind: NextStepKind; title: string; detail: string; tone: "urgent" | "normal" | "done" };

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function clock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function dayMonth(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);
}

/** Elapsed time in plain words: "agora há pouco", "há 5 min", "há 2 h", "há 3 dias". */
export function elapsedLabel(from: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/**
 * The moment the lead was DISTRIBUTED to the broker (assignedAt), never when it entered the brokerage (createdAt).
 * Broker: "Recebido por você hoje às 14:32 · Plantão X". Supervisor and gestor: "Distribuído para Ana hoje às ...".
 * Anything that is not from today is stale: nobody mistakes an old lead for today's.
 */
export function arrivalView({ arrivedAt, now, dutyName, viewer = "broker", ownerName }: { arrivedAt: Date; now: Date; dutyName?: string | null; viewer?: "broker" | "management"; ownerName?: string | null }): ArrivalView {
  const today = dayKey(now);
  const arrivedKey = dayKey(arrivedAt);
  const received = viewer === "management" ? `Distribuído para ${ownerName ?? "o corretor"}` : "Recebido por você";
  let when: string;
  let stale = false;
  if (arrivedKey === today) {
    when = `hoje às ${clock(arrivedAt)}`;
  } else if (arrivedKey === dayKey(new Date(now.getTime() - 86_400_000))) {
    when = `ontem às ${clock(arrivedAt)}`;
    stale = true;
  } else {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${arrivedKey}T00:00:00Z`)) / 86_400_000);
    when = `em ${dayMonth(arrivedAt)}, há ${days} dias`;
    stale = true;
  }
  return { text: `${received} ${when}${dutyName ? ` · Plantão ${dutyName}` : ""}`, stale };
}

/**
 * The next step, one only, in the order it matters: accept, then the client waiting for an answer,
 * then the first contact, then the AI suggestion. The management viewer gets the same moment worded
 * for someone who watches the chat but does not act in it.
 */
export function nextStepFor(input: {
  viewer?: "broker" | "management";
  owned: boolean;
  accepted: boolean;
  closed: boolean;
  ownerName?: string | null;
  lastClientAt: Date | null;
  lastBrokerAt: Date | null;
  nextAction: string | null;
  now: Date;
}): NextStep {
  const management = input.viewer === "management";
  const owner = input.ownerName ?? "O corretor";
  if (input.closed) return { kind: "closed", title: "Lead encerrado", detail: "Nada a fazer neste lead.", tone: "done" };
  if (!input.owned) return { kind: "none", title: "Este lead está com outro corretor", detail: "Você pode ver o histórico, mas não atende.", tone: "normal" };
  if (!input.accepted) {
    return management
      ? { kind: "wait", title: "Aguardando o aceite do corretor", detail: `${owner} ainda não aceitou.`, tone: "normal" }
      : { kind: "accept", title: "Aceite o lead", detail: "Aceite para liberar o telefone e começar o atendimento.", tone: "urgent" };
  }
  const clientWaiting = input.lastClientAt && (!input.lastBrokerAt || input.lastClientAt > input.lastBrokerAt);
  if (clientWaiting) {
    const ago = elapsedLabel(input.lastClientAt as Date, input.now);
    return management
      ? { kind: "wait", title: "Cliente aguardando resposta", detail: `Respondeu ${ago}. ${owner} ainda não respondeu.`, tone: "urgent" }
      : { kind: "reply", title: "Responder o cliente", detail: `Cliente respondeu ${ago}.`, tone: "urgent" };
  }
  if (!input.lastBrokerAt) {
    return management
      ? { kind: "wait", title: "O corretor ainda não chamou o cliente", detail: "Nenhuma mensagem enviada até agora.", tone: "urgent" }
      : { kind: "whatsapp", title: "Você ainda não chamou o cliente", detail: "Chame no WhatsApp para começar o atendimento.", tone: "urgent" };
  }
  const suggestion = nextStepText(input.nextAction);
  if (suggestion) return { kind: management ? "wait" : "whatsapp", title: suggestion, detail: "Sugestão da IA.", tone: "normal" };
  return management
    ? { kind: "wait", title: "Sem pendência no momento", detail: `Último contato do corretor ${elapsedLabel(input.lastBrokerAt, input.now)}.`, tone: "normal" }
    : { kind: "schedule", title: "Acompanhe o cliente", detail: `Último contato ${elapsedLabel(input.lastBrokerAt, input.now)}.`, tone: "normal" };
}
