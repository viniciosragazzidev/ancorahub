import type { ChatBlock, ChatChoice, ChatFactRow, ChatScript } from "@/components/chat/types";
import { DECLINE_REASONS } from "@/features/broker-workspace/components/light-lead-detail/types";
import { LEAD_STATUS_LABELS, MOTIVO_PERDA_LABELS, type MotivoPerda } from "@/features/leads/lead-status-constants";

import { isOutboundMessage, nextStepText } from "./intelligence";

const TIME_ZONE = "America/Sao_Paulo";

/** What the lead conversation needs from the lead (already redacted for privacy by the page). */
export type LeadConversationLead = {
  id: string;
  nome: string;
  status: string;
  telefone: string | null;
  tipo?: string | null;
  origem?: string | null;
  sourceCampaign?: string | null;
  livesCount?: number | null;
  city?: string | null;
  urgency?: string | null;
  summary?: string | null;
  branchName?: string | null;
  motivoPerda?: string | null;
  createdAt: Date;
  assignedAt?: Date | null;
  slaFirstContactMinutes: number;
  isCurrentBroker: boolean;
  /** AI marked it as a likely sale: losing it needs a written justification (full record). */
  potentialSale: boolean;
  clientInfo?: Array<{ key: string; label: string; value: string }>;
};

/** One row of the lead history (lead_interactions). */
export type LeadConversationEvent = {
  id: string;
  tipo: string;
  conteudo: string;
  userId: string | null;
  userName: string | null;
  createdAt: Date;
};

/** A WhatsApp message mirrored by the CRM (client on the left, broker on the right). */
export type LeadConversationMessage = { id: string; body: string; direction: string; sentAt: Date; senderRole?: string | null };

/** What the AI read in the WhatsApp conversation. */
export type LeadConversationAdvice = { nextBestAction: string | null; pendingFrom: string | null };

const HISTORY_LIMIT = 15;
const MESSAGES_LIMIT = 20;
const IN_SERVICE = new Set(["in_contact", "quote_sent", "negotiation"]);
const LOSS_CHOICES: MotivoPerda[] = ["sem_contato", "sem_interesse", "preco", "ja_contratou", "encontrou_mais_barato", "desistiu", "outro"];
const RETURN_CHOICES = [
  { value: "today", label: "Hoje às 18h" },
  { value: "tomorrow", label: "Amanhã de manhã" },
  { value: "in_2_days", label: "Em 2 dias" },
  { value: "in_3_days", label: "Em 3 dias" },
] as const;

function time(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** "Hoje, 09:41", "Ontem, 18:02" or "07/10, 14:10". */
export function dateLabel(date: Date, now: Date) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const key = dayKey(date);
  const prefix = key === today ? "Hoje" : key === yesterday ? "Ontem" : new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);
  return `${prefix}, ${time(date)}`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function originLabel(lead: LeadConversationLead) {
  if (lead.sourceCampaign) return `da campanha ${lead.sourceCampaign}`;
  if (lead.origem) return `pelo canal ${lead.origem.replace(/_/g, " ")}`;
  return null;
}

function factRows(lead: LeadConversationLead): ChatFactRow[] {
  const rows: ChatFactRow[] = [];
  if (lead.tipo) rows.push({ label: "Tipo", value: lead.tipo.toUpperCase() === "PME" ? "PME" : lead.tipo });
  if (lead.livesCount) rows.push({ label: "Vidas", value: String(lead.livesCount) });
  if (lead.city) rows.push({ label: "Cidade", value: lead.city });
  if (lead.urgency) rows.push({ label: "Urgência", value: lead.urgency });
  if (lead.telefone) rows.push({ label: "Telefone", value: lead.telefone });
  if (lead.branchName) rows.push({ label: "Unidade", value: lead.branchName });
  const shown = new Set(rows.map((row) => row.label.toLocaleLowerCase("pt-BR")));
  for (const info of lead.clientInfo ?? []) {
    if (rows.length >= 8) break;
    if (shown.has(info.label.toLocaleLowerCase("pt-BR")) || !info.value) continue;
    rows.push({ label: info.label, value: info.value });
  }
  return rows;
}

/** A history row becomes a chat block: the broker's notes on the right, everything else as a centered note. */
function eventBlock(event: LeadConversationEvent, viewerId: string): ChatBlock {
  const at = time(event.createdAt);
  if (event.tipo === "note" && event.userId === viewerId) return { type: "user", id: `ev-${event.id}`, text: event.conteudo, at };
  if (event.tipo === "note") return { type: "system", id: `ev-${event.id}`, strong: event.userName ?? "Equipe", text: `anotou: ${event.conteudo}` };
  if (event.tipo === "whatsapp_msg") return { type: "assistant", id: `ev-${event.id}`, text: event.conteudo, at };
  return { type: "system", id: `ev-${event.id}`, text: `${event.conteudo} · ${at}` };
}

function declineQuestion(lead: LeadConversationLead): ChatBlock {
  return {
    type: "question",
    id: "q-decline",
    prompt: "Por que você vai recusar?",
    choices: DECLINE_REASONS.map((reason) => ({
      id: `decline-${reason}`,
      label: reason,
      action: { kind: "server", name: "lead.decline", payload: { leadId: lead.id, reason } },
    })),
  };
}

function returnQuestion(lead: LeadConversationLead): ChatBlock {
  return {
    type: "question",
    id: "q-return",
    prompt: "Quando você quer falar com ele de novo?",
    choices: RETURN_CHOICES.map((option) => ({
      id: `return-${option.value}`,
      label: option.label,
      reply: `Retorno ${option.label.toLocaleLowerCase("pt-BR")}`,
      action: { kind: "server", name: "lead.scheduleReturn", payload: { leadId: lead.id, when: option.value } },
    })),
  };
}

function quoteFollowUpQuestion(lead: LeadConversationLead): ChatBlock {
  return {
    type: "question",
    id: "q-quote",
    prompt: "Boa. Quando eu te lembro de acompanhar a cotação?",
    choices: RETURN_CHOICES.filter((option) => option.value !== "today").map((option) => ({
      id: `quote-${option.value}`,
      label: option.label,
      action: { kind: "server", name: "lead.changeStep", payload: { leadId: lead.id, status: "quote_sent", when: option.value } },
    })),
  };
}

function lostQuestion(lead: LeadConversationLead): ChatBlock {
  return {
    type: "question",
    id: "q-lost",
    prompt: "O que aconteceu?",
    choices: LOSS_CHOICES.map((reason) => ({
      id: `lost-${reason}`,
      label: MOTIVO_PERDA_LABELS[reason],
      action: { kind: "server", name: "lead.markLost", payload: { leadId: lead.id, reason } },
    })),
  };
}

function fichaChoice(lead: LeadConversationLead, label = "Ver a ficha completa", hash = ""): ChatChoice {
  return { id: `ficha${hash}`, label, action: { kind: "href", href: `/leads/${lead.id}?ficha=1${hash}` } };
}

const WHATSAPP_BUTTON_ID = "b-whatsapp";

/** "Chamar no WhatsApp" answers with a button right below (a real link the phone never blocks). */
function whatsappChoice(whatsappUrl: string | null): ChatChoice[] {
  return whatsappUrl ? [{ id: "whatsapp", label: "Chamar no WhatsApp", reply: "Vou chamar no WhatsApp", action: { kind: "next", questionId: WHATSAPP_BUTTON_ID } }] : [];
}

export function whatsappButton(id: string, href: string, text?: string): ChatBlock {
  return { type: "button", id, text, label: "Abrir WhatsApp", href, tone: "whatsapp" };
}

/** The suggested replies for where the attendance is now. */
function nextStep(lead: LeadConversationLead, now: Date, whatsappUrl: string | null, advice: LeadConversationAdvice | null): ChatBlock[] {
  const name = firstName(lead.nome);
  if (!lead.isCurrentBroker) {
    return [
      { type: "assistant", id: "a-readonly", text: `Este lead está com outro corretor agora (${LEAD_STATUS_LABELS[lead.status] ?? lead.status}).` },
      { type: "question", id: "q-main", prompt: "Quer ver os detalhes?", choices: [fichaChoice(lead)] },
    ];
  }

  if (lead.status === "distributed" || lead.status === "new") {
    const base = lead.assignedAt ?? lead.createdAt;
    const left = lead.slaFirstContactMinutes - Math.floor((now.getTime() - base.getTime()) / 60_000);
    const sla = left > 0 ? `Faltam ${left} min para o primeiro contato.` : "O prazo do primeiro contato já passou: fale com ele agora.";
    return [
      { type: "assistant", id: "a-next", text: `${name} está esperando você. ${sla}` },
      {
        type: "question",
        id: "q-main",
        prompt: "Vamos atender?",
        choices: [
          { id: "start", label: "Aceitar e chamar no WhatsApp", reply: "Aceito, vou chamar agora", action: { kind: "server", name: "lead.registerContact", payload: { leadId: lead.id } } },
          { id: "decline", label: "Recusar", action: { kind: "next", questionId: "q-decline" } },
          fichaChoice(lead),
        ],
      },
      declineQuestion(lead),
    ];
  }

  if (IN_SERVICE.has(lead.status)) {
    const stage = LEAD_STATUS_LABELS[lead.status] ?? lead.status;
    const choices: ChatChoice[] = [...whatsappChoice(whatsappUrl)];
    if (lead.status !== "quote_sent") choices.push({ id: "quote", label: "Enviei a cotação", action: { kind: "next", questionId: "q-quote" } });
    if (lead.status !== "negotiation") choices.push({ id: "negotiation", label: "Estamos negociando", action: { kind: "server", name: "lead.changeStep", payload: { leadId: lead.id, status: "negotiation" } } });
    choices.push({ id: "return", label: "Agendar retorno", action: { kind: "next", questionId: "q-return" } });
    choices.push(fichaChoice(lead, "Fechou: registrar a venda", "#venda"));
    choices.push(
      lead.potentialSale
        ? { ...fichaChoice(lead, "Não deu certo", "#etapa"), hint: "A IA marcou como venda provável: justifique na ficha" }
        : { id: "lost", label: "Não deu certo", action: { kind: "next", questionId: "q-lost" } },
    );
    const owesAnswer = advice?.pendingFrom === "BROKER";
    const lead_ = owesAnswer ? `${name} está esperando sua resposta.` : `Etapa atual: ${stage}. Me conta como está e eu registro.`;
    const blocks: ChatBlock[] = [
      { type: "assistant", id: "a-next", text: lead_ },
      ...(nextStepText(advice?.nextBestAction) ? [{ type: "assistant" as const, id: "a-advice", text: `Sugestão: ${nextStepText(advice?.nextBestAction)}` }] : []),
      { type: "question", id: "q-main", prompt: `E aí, como está o ${name}?`, choices },
      returnQuestion(lead),
    ];
    if (lead.status !== "quote_sent") blocks.push(quoteFollowUpQuestion(lead));
    if (!lead.potentialSale) blocks.push(lostQuestion(lead));
    return blocks;
  }

  if (lead.status === "documentation_pending" || lead.status === "under_analysis") {
    return [
      { type: "assistant", id: "a-next", text: lead.status === "documentation_pending" ? "Venda pedida. Falta a documentação para o supervisor aprovar." : "A venda está em análise com o supervisor. Eu te aviso quando sair." },
      { type: "question", id: "q-main", prompt: "Quer adiantar algo?", choices: [fichaChoice(lead, "Enviar ou ver documentos", "#venda"), ...whatsappChoice(whatsappUrl)] },
    ];
  }

  if (lead.status === "converted") {
    return [
      { type: "assistant", id: "a-next", text: `Venda concluída. Parabéns pelo ${name}!` },
      { type: "question", id: "q-main", prompt: "Mais alguma coisa?", choices: [fichaChoice(lead), ...whatsappChoice(whatsappUrl)] },
    ];
  }

  const reason = lead.motivoPerda ? MOTIVO_PERDA_LABELS[lead.motivoPerda as MotivoPerda] ?? lead.motivoPerda : null;
  return [
    { type: "assistant", id: "a-next", text: `Atendimento encerrado${reason ? `: ${reason}` : ""}.` },
    { type: "question", id: "q-main", prompt: "Quer ver o histórico?", choices: [fichaChoice(lead)] },
  ];
}

/**
 * The lead as a conversation (route /leads/{id} in the broker app): who
 * arrived and from where, the facts card, the history as chat, and the next
 * step as suggested replies. Pure: the page passes the data and `now`.
 */
export function buildLeadConversationScript({
  lead,
  events,
  viewerId,
  now,
  whatsappUrl,
  messages = [],
  advice = null,
}: {
  lead: LeadConversationLead;
  events: LeadConversationEvent[];
  viewerId: string;
  now: Date;
  whatsappUrl: string | null;
  /** WhatsApp mirror, only for the lead's own broker. */
  messages?: LeadConversationMessage[];
  advice?: LeadConversationAdvice | null;
}): ChatScript {
  const origin = originLabel(lead);
  const rows = factRows(lead);
  // History and WhatsApp in one timeline: the latest of each, in time order.
  type Entry = { at: Date; block: ChatBlock; id: string };
  const history: Entry[] = [
    ...[...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(-HISTORY_LIMIT).map((event) => ({ at: event.createdAt, id: event.id, block: eventBlock(event, viewerId) })),
    ...[...messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime()).slice(-MESSAGES_LIMIT).map((message) => ({
      at: message.sentAt,
      id: `wa-${message.id}`,
      block: {
        type: "whatsapp" as const,
        id: `wa-${message.id}`,
        text: message.body,
        at: time(message.sentAt),
        // Outbound with senderRole "assistant" is the AI qualification; other outbound is the broker.
        from: !isOutboundMessage(message.direction) ? "client" as const : message.senderRole === "assistant" ? "qualification" as const : "broker" as const,
      },
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const blocks: ChatBlock[] = [
    { type: "date", id: "d-created", label: dateLabel(lead.createdAt, now) },
    { type: "system", id: "s-arrived", strong: lead.nome, text: `chegou${origin ? ` ${origin}` : ""}` },
  ];
  if (rows.length) blocks.push({ type: "facts", id: "f-lead", title: lead.nome, subtitle: LEAD_STATUS_LABELS[lead.status] ?? lead.status, rows, href: `/leads/${lead.id}?ficha=1`, hrefLabel: "Ver ficha" });
  if (lead.summary) blocks.push({ type: "assistant", id: "a-summary", text: lead.summary });

  let lastDay = dayKey(lead.createdAt);
  for (const entry of history) {
    const key = dayKey(entry.at);
    if (key !== lastDay) {
      blocks.push({ type: "date", id: `d-${entry.id}`, label: dateLabel(entry.at, now) });
      lastDay = key;
    }
    blocks.push(entry.block);
  }

  blocks.push(...nextStep(lead, now, whatsappUrl, advice));
  const offersWhatsApp = blocks.some((block) => block.type === "question" && block.choices.some((choice) => choice.action.kind === "next" && choice.action.questionId === WHATSAPP_BUTTON_ID));
  if (offersWhatsApp && whatsappUrl) blocks.push(whatsappButton(WHATSAPP_BUTTON_ID, whatsappUrl, "A mensagem de apresentação já vai pronta. É só tocar:"));

  const waiting = lead.isCurrentBroker && (lead.status === "distributed" || lead.status === "new" || IN_SERVICE.has(lead.status));
  return {
    blocks,
    composerPlaceholder: lead.isCurrentBroker ? "Escreva uma nota ou pergunte algo terminando com ?" : "Só o corretor do lead pode anotar aqui",
    status: waiting
      ? { label: lead.status === "distributed" || lead.status === "new" ? "Esperando você" : LEAD_STATUS_LABELS[lead.status] ?? "Em atendimento", tone: lead.status === "distributed" || lead.status === "new" ? "waiting" : "idle" }
      : { label: LEAD_STATUS_LABELS[lead.status] ?? lead.status, tone: "paused" },
  };
}
