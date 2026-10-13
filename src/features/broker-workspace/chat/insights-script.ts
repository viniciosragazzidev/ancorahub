import type { ChatBlock, ChatChoice, ChatScript, ThreadSummary } from "@/components/chat/types";
import type { BrokerConversationInsight } from "@/features/broker-workspace/components/light-conversations-view";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import { intelligenceLabel, intelligenceTips, isOutboundMessage, nextStepText } from "./intelligence";

const TIME_ZONE = "America/Sao_Paulo";
const OTHERS_SHOWN = 5;
/** Varied openers (stable within the hour), so the tips feel like a person reading the chats. */
const OPENERS = ["Li suas conversas.", "Dei uma olhada no WhatsApp.", "Olha quem precisa de você.", "Separei a próxima conversa."];
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

/**
 * A practical tip from the messages alone, while the AI has not read the
 * conversation yet: who spoke last and how long ago.
 */
export function quickTip(item: BrokerConversationInsight, now: Date) {
  const last = item.latestMessage;
  if (!last) return "Ainda sem conversa: mande um oi se apresentando e pergunte a melhor hora para falar.";
  const ago = waited(last.sentAt, now);
  if (!isOutboundMessage(last.direction)) return `O cliente escreveu há ${ago}. Responda agora, mesmo que curto: quem responde rápido vende mais.`;
  const hours = (now.getTime() - Date.parse(last.sentAt)) / 3_600_000;
  if (hours >= 24) return `Sua última mensagem foi há ${ago} e ficou sem resposta. Mande uma retomada leve, tipo: "Conseguiu ver o que te mandei?"`;
  return "Você já respondeu. Combine o próximo passo com data, por exemplo um horário para apresentar a cotação.";
}

/** The client in focus: name in highlight, stage, how long they wait and when they last wrote. */
function clientCard(id: string, item: BrokerConversationInsight, now: Date): ChatBlock {
  const chips: Array<{ label: string; tone?: "info" | "success" | "warning" | "danger" | "neutral" }> = [];
  // One chromatic color per card: only the delay is red; the rest stay neutral.
  chips.push({ label: item.kind === "client" ? "Cliente" : LEAD_STATUS_LABELS[item.status] ?? item.status, tone: "neutral" });
  const inbound = lastInbound(item);
  if (isWaitingForBroker(item) && inbound) chips.push({ label: `Esperando há ${waited(inbound.sentAt, now)}`, tone: "danger" });
  else if (item.latestMessage) chips.push({ label: `Última mensagem às ${time(item.latestMessage.sentAt)}`, tone: "neutral" });
  const intent = item.intelligence?.customerIntent ? intelligenceLabel.intent(item.intelligence.customerIntent) : null;
  if (intent) chips.push({ label: `Intenção: ${intent}`, tone: "neutral" });
  return { type: "client", id, name: item.name, initials: initialsOf(item.name), chips };
}

/** Each conversation opens its analysis (insights and next step), never a copy of the lead screen. */
function detailHref(item: BrokerConversationInsight) {
  return `/conversas/broker?insight=${encodeURIComponent(item.id)}`;
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
      const step = nextStepText(item.intelligence?.nextBestAction);
      const preview = step
        ? `Próximo passo: ${step}`
        : item.intelligence?.summary ? clip(item.intelligence.summary, 90) : last ? `${isOutboundMessage(last.direction) ? "Você: " : ""}${clip(last.body, 90)}` : item.status;
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
  if (!whatsappConnected) blocks.push({ type: "system", id: "i-offline", text: "WhatsApp desconectado: mostrando as mensagens que já chegaram." });

  if (!waiting.length) {
    blocks.push({ type: "assistant", id: "i-clear", text: "Ninguém esperando sua resposta agora." });
    const recent = insights.slice(0, OTHERS_SHOWN).map((item) => ({ id: item.id, lead: item.name, primary: item.name, secondary: nextStepText(item.intelligence?.nextBestAction) ?? (item.intelligence?.summary ? clip(item.intelligence.summary, 80) : clip(quickTip(item, now), 70)), trailing: item.latestMessage ? time(item.latestMessage.sentAt) : undefined, href: detailHref(item) }));
    if (recent.length) blocks.push({ type: "list", id: "i-recent", title: "Conversas recentes", subtitle: "Toque para ver o diagnóstico", items: recent });
    blocks.push({ type: "question", id: "i-clear-choice", prompt: "Quer ver mais?", choices: [all] });
    return { blocks, status: { label: "Em dia", tone: "idle" } };
  }

  const [{ item: first, since }, ...rest] = waiting;
  const name = firstName(first.name);
  const inbound = lastInbound(first);
  blocks.push({
    type: "assistant",
    id: "i-count",
    text: `${OPENERS[(Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now)) + Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, day: "2-digit" }).format(now))) % OPENERS.length]} ${waiting.length === 1 ? `${name} está esperando sua resposta há ${waited(since, now)}.` : `${waiting.length} clientes esperando sua resposta. Comece por ${name}, que espera há ${waited(since, now)}.`}`,
  });
  blocks.push(clientCard("i-client", first, now));
  if (first.intelligence?.summary) blocks.push({ type: "assistant", id: "i-summary", text: first.intelligence.summary });
  else if (inbound) blocks.push({ type: "system", id: "i-last", strong: name, text: `escreveu às ${time(inbound.sentAt)}` });
  const step = nextStepText(first.intelligence?.nextBestAction);
  blocks.push({ type: "assistant", id: "i-next", variant: "tip", text: step ? `Próximo passo: ${step}` : quickTip(first, now) });

  const whatsapp = buildWhatsAppUrl(first.phone);
  const choices: ChatChoice[] = [
    ...(whatsapp ? [{ id: "reply", label: `Responder ${name} no WhatsApp`, reply: `Vou responder ${name}`, action: { kind: "href" as const, href: whatsapp } }] : []),
    { id: "detail", label: "Ver a análise completa", hint: "Leitura da conversa, sinais e dicas", action: { kind: "href", href: detailHref(first) } },
    { id: "lead", label: first.kind === "client" ? "Abrir o cliente" : "Abrir o lead", action: { kind: "href", href: first.href } },
  ];
  blocks.push({ type: "question", id: "i-choice", prompt: "Como quer seguir?", choices });

  // Everyone else stays one tap away: their own analysis (the list used to show only those waiting).
  const waitingIds = new Set(waiting.map(({ item }) => item.id));
  const others = insights.filter((item) => !waitingIds.has(item.id)).slice(0, OTHERS_SHOWN);
  if (rest.length) {
    blocks.push({
      type: "list",
      id: "i-others",
      title: "Depois",
      subtitle: "Também esperando você",
      items: rest.slice(0, OTHERS_SHOWN).map(({ item, since: at }) => ({ id: item.id, lead: item.name, primary: item.name, secondary: nextStepText(item.intelligence?.nextBestAction) ?? (item.intelligence?.summary ? clip(item.intelligence.summary, 80) : clip(quickTip(item, now), 80)), trailing: waited(at, now), href: detailHref(item) })),
    });
  }
  if (others.length) {
    blocks.push({
      type: "list",
      id: "i-recent",
      title: "Outros clientes",
      subtitle: "Toque para ver o diagnóstico",
      items: others.map((item) => ({ id: item.id, lead: item.name, primary: item.name, secondary: nextStepText(item.intelligence?.nextBestAction) ?? (item.intelligence?.summary ? clip(item.intelligence.summary, 80) : clip(quickTip(item, now), 80)), trailing: item.latestMessage ? time(item.latestMessage.sentAt) : undefined, href: detailHref(item) })),
    });
  }

  return { blocks, status: { label: "Esperando você", tone: "waiting" } };
}

function analyzedLabel(iso: string | null | undefined, now: Date) {
  if (!iso) return "Análise da conversa";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Análise da conversa";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
  const prefix = day === today ? "Hoje" : new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);
  return `Análise de ${prefix.toLowerCase() === "hoje" ? "hoje" : prefix}, ${time(iso)}`;
}

/**
 * The analysis of one conversation (route /conversas/broker?insight={id}):
 * what the AI read, buying signals and objections, risk and opportunity, the
 * next step and practical tips. No message transcript: the conversation itself
 * lives in the lead screen.
 */
export function buildLeadInsightScript(input: { item: BrokerConversationInsight; now: Date; analyzing?: boolean }): ChatScript {
  const { item, now } = input;
  const ai = item.intelligence ?? null;
  const name = firstName(item.name);
  const whatsapp = buildWhatsAppUrl(item.phone);
  const actions: ChatChoice[] = [
    ...(whatsapp ? [{ id: "reply", label: `Responder ${name} no WhatsApp`, action: { kind: "href" as const, href: whatsapp } }] : []),
    { id: "lead", label: item.kind === "client" ? "Abrir o cliente" : "Abrir o lead", action: { kind: "href", href: item.href } },
    { id: "all", label: "Ver outros clientes", hint: "A lista com o diagnóstico de cada um", action: { kind: "href", href: "/conversas/broker" } },
  ];

  if (!ai || (!ai.summary && !ai.nextBestAction)) {
    return {
      blocks: [
        clientCard("n-client", item, now),
        { type: "assistant", id: "n-empty", text: input.analyzing ? `Estou lendo a conversa com ${name} agora. Em alguns segundos a análise aparece aqui.` : `Ainda não li a conversa com ${name}.` },
        { type: "assistant", id: "n-quick", variant: "tip", text: quickTip(item, now) },
        { type: "question", id: "n-choice", prompt: "Como quer seguir?", choices: actions },
      ],
      status: { label: input.analyzing ? "Lendo a conversa…" : "Esperando você", tone: input.analyzing ? "working" : "idle" },
    };
  }

  const blocks: ChatBlock[] = [{ type: "date", id: "n-date", label: analyzedLabel(ai.lastAnalyzedAt, now) }, clientCard("n-client", item, now)];
  if (ai.summary) blocks.push({ type: "assistant", id: "n-summary", text: ai.summary });

  const rows = [
    { label: "Estágio", value: intelligenceLabel.stage(ai.conversationStage) },
    { label: "Intenção de compra", value: intelligenceLabel.intent(ai.customerIntent) },
    { label: "Sentimento", value: intelligenceLabel.sentiment(ai.sentiment) },
    { label: "Engajamento", value: intelligenceLabel.engagement(ai.engagement) },
    { label: "Quem deve responder", value: intelligenceLabel.pending(ai.pendingFrom) },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  if (rows.length) blocks.push({ type: "facts", id: "n-reading", title: "Leitura da conversa", subtitle: item.name, rows });

  const signals = ai.buyingSignals ?? [];
  if (signals.length) blocks.push({ type: "list", id: "n-signals", title: "Sinais de compra", items: signals.slice(0, 5).map((text, index) => ({ id: `s${index}`, primary: clip(text, 120) })) });
  const objections = ai.objections ?? [];
  if (objections.length) blocks.push({ type: "list", id: "n-objections", title: "Objeções", items: objections.slice(0, 5).map((text, index) => ({ id: `o${index}`, primary: clip(text, 120) })) });
  if (ai.risk) blocks.push({ type: "system", id: "n-risk", strong: "Risco:", text: clip(ai.risk, 200) });
  if (ai.opportunity) blocks.push({ type: "system", id: "n-opportunity", strong: "Oportunidade:", text: clip(ai.opportunity, 200) });

  const step = nextStepText(ai.nextBestAction);
  if (step) blocks.push({ type: "assistant", id: "n-step", variant: "tip", text: `Próximo passo: ${step}` });
  intelligenceTips(ai).forEach((tip, index) => blocks.push({ type: "assistant", id: `n-tip-${index}`, variant: "tip", text: tip }));

  blocks.push({ type: "question", id: "n-choice", prompt: "Como quer seguir?", choices: actions });
  return { blocks, status: ai.pendingFrom === "BROKER" ? { label: "Esperando você", tone: "waiting" } : { label: "Analisado", tone: "idle" } };
}
