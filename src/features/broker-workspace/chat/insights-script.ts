import type { ChatBlock, ChatChoice, ChatScript, ThreadSummary } from "@/components/chat/types";
import type { BrokerConversationInsight } from "@/features/broker-workspace/components/light-conversations-view";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

import { isOutboundMessage } from "./intelligence";

const TIME_ZONE = "America/Sao_Paulo";
const OTHERS_SHOWN = 5;
const LAST_MESSAGE_CHARS = 140;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function waited(fromIso: string, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(fromIso)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function time(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

function clip(text: string, max = LAST_MESSAGE_CHARS) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * The client owes nothing and the broker does: the AI says so (pendingFrom
 * BROKER) or, without an analysis, the last message came from the client.
 */
export function isWaitingForBroker(item: BrokerConversationInsight) {
  const pending = item.intelligence?.pendingFrom;
  if (pending) return pending === "BROKER";
  return Boolean(item.latestMessage && !isOutboundMessage(item.latestMessage.direction));
}

/** Last message from the client (what the broker has to answer). */
function lastInbound(item: BrokerConversationInsight) {
  return [...item.messages].reverse().find((message) => !isOutboundMessage(message.direction)) ?? null;
}

/** The conversation opens as the lead's chat (WhatsApp mirror included); clients open their record. */
function detailHref(item: BrokerConversationInsight) {
  return item.href;
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("") || "?";
}

/** All conversations as chat rows: who waits for you first, then the most recent. */
export function buildInsightThreads(insights: BrokerConversationInsight[]): ThreadSummary[] {
  return insights
    .map((item) => {
      const waiting = isWaitingForBroker(item);
      const last = item.latestMessage;
      const preview = waiting && item.intelligence?.nextBestAction
        ? `Sugestão: ${item.intelligence.nextBestAction}`
        : last ? `${isOutboundMessage(last.direction) ? "Você: " : ""}${clip(last.body, 90)}` : item.status;
      return {
        id: `insight:${item.id}`,
        kind: "lead" as const,
        leadId: item.kind === "lead" ? item.id : undefined,
        name: item.name,
        preview,
        at: last?.sentAt ?? null,
        unread: waiting,
        waitingYou: waiting,
        href: detailHref(item),
        shape: "mochi" as const,
        hue: null,
        initials: initialsOf(item.name),
        temperature: null,
      };
    })
    .sort((left, right) => (left.waitingYou === right.waitingYou ? (Date.parse(right.at ?? "") || 0) - (Date.parse(left.at ?? "") || 0) : left.waitingYou ? -1 : 1));
}

/**
 * The Insights assistant (route /conversas/broker in the broker app): who is
 * waiting for an answer, the oldest first, with the AI's suggestion and the
 * one-tap reply on WhatsApp. Pure: the page passes the conversations and now.
 */
export function buildInsightsScript(input: { insights: BrokerConversationInsight[]; whatsappConnected: boolean; now: Date }): ChatScript {
  const { insights, whatsappConnected, now } = input;
  const all: ChatChoice = { id: "all", label: "Ver todas as conversas", action: { kind: "href", href: "/conversas/broker?todas=1" } };

  if (!whatsappConnected && insights.length === 0) {
    return {
      blocks: [
        { type: "assistant", id: "i-connect", text: "Conecte seu WhatsApp e eu leio suas conversas para te dizer quem responder primeiro e o que falar." },
        { type: "question", id: "i-connect-choice", prompt: "Vamos conectar?", choices: [{ id: "connect", label: "Conectar meu WhatsApp", action: { kind: "href", href: "/settings/whatsapp" } }] },
      ],
      status: { label: "WhatsApp desconectado", tone: "paused" },
    };
  }

  const waiting = insights
    .filter(isWaitingForBroker)
    .map((item) => ({ item, since: lastInbound(item)?.sentAt ?? item.latestMessage?.sentAt ?? now.toISOString() }))
    .sort((left, right) => Date.parse(left.since) - Date.parse(right.since));

  const blocks: ChatBlock[] = [];
  if (!whatsappConnected) blocks.push({ type: "system", id: "i-offline", text: "WhatsApp desconectado: mostrando as últimas mensagens sincronizadas." });

  if (!waiting.length) {
    blocks.push({ type: "assistant", id: "i-clear", text: "Ninguém esperando sua resposta agora." });
    const recent = insights.slice(0, OTHERS_SHOWN).map((item) => ({ id: item.id, lead: item.name, primary: item.name, secondary: item.latestMessage ? clip(item.latestMessage.body, 70) : item.status, trailing: item.latestMessage ? time(item.latestMessage.sentAt) : undefined, href: detailHref(item) }));
    if (recent.length) blocks.push({ type: "list", id: "i-recent", title: "Conversas recentes", items: recent });
    blocks.push({ type: "question", id: "i-clear-choice", prompt: "Quer ver mais?", choices: [all] });
    return { blocks, status: { label: "Em dia", tone: "idle" } };
  }

  const [{ item: first, since }, ...rest] = waiting;
  const name = firstName(first.name);
  const inbound = lastInbound(first);
  blocks.push({
    type: "assistant",
    id: "i-count",
    text: waiting.length === 1 ? `${name} está esperando sua resposta há ${waited(since, now)}.` : `${waiting.length} clientes esperando sua resposta. Comece por ${name}, que espera há ${waited(since, now)}.`,
  });
  if (inbound) blocks.push({ type: "system", id: "i-last", strong: name, text: `disse às ${time(inbound.sentAt)}: "${clip(inbound.body)}"` });
  if (first.intelligence?.summary) blocks.push({ type: "assistant", id: "i-summary", text: first.intelligence.summary });
  if (first.intelligence?.nextBestAction) blocks.push({ type: "assistant", id: "i-next", text: `Sugestão: ${first.intelligence.nextBestAction}` });

  const whatsapp = buildWhatsAppUrl(first.phone);
  const choices: ChatChoice[] = [
    ...(whatsapp ? [{ id: "reply", label: `Responder ${name} no WhatsApp`, reply: `Vou responder ${name}`, action: { kind: "href" as const, href: whatsapp } }] : []),
    { id: "detail", label: first.kind === "client" ? "Abrir o cliente" : "Ver a conversa inteira", action: { kind: "href", href: detailHref(first) } },
  ];
  blocks.push({ type: "question", id: "i-choice", prompt: "Como quer seguir?", choices });

  if (rest.length) {
    blocks.push({
      type: "list",
      id: "i-others",
      title: "Depois",
      subtitle: "Também esperando você",
      items: rest.slice(0, OTHERS_SHOWN).map(({ item, since: at }) => ({ id: item.id, lead: item.name, primary: item.name, secondary: item.intelligence?.nextBestAction ? clip(item.intelligence.nextBestAction, 80) : clip(lastInbound(item)?.body ?? "", 70), trailing: waited(at, now), href: detailHref(item) })),
    });
  }

  return { blocks, status: { label: "Esperando você", tone: "waiting" } };
}
