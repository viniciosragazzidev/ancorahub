/**
 * Núcleo do Sasá agêntico (fase 1): a frase vira uma intenção tipada, o lead e a data são resolvidos aqui e
 * a execução usa SEMPRE uma ação que o app já tinha (`runChatServerAction`, com as checagens e a auditoria
 * dela). Nada de SQL livre nem id vindo da IA. O servidor e o laboratório usam este mesmo núcleo; só o
 * `run` muda (real ou simulado). Plano: docs/implementations/active/2026-11-19-sasa-agentica.md.
 *
 * Confirmação (D2): ação reversível executa direto e devolve "Desfazer"; leitura responde na hora.
 */
import type { ChatBlock, ChatChoice, ChatLeadRow, ChatServerActionName } from "@/components/chat/types";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { DECLINE_REASONS } from "@/features/broker-workspace/components/light-lead-detail/types";
import { MOTIVO_PERDA_LABELS, type MotivoPerda } from "@/features/leads/lead-status-constants";
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-url";

import { parseSpokenQuote, parseSpokenSale, type SasaOpen } from "./drafts";
import { classifySasaText, nameHintOf, splitSasaSteps, SASA_STAGE_LABEL, type SasaIntent, type SasaStage, type SasaTool } from "./intent-rules";
import { clockLabel, parseWhenPtBr, whenLabel } from "./parse-when";
import { firstNameOf, resolveLead, type SasaLead } from "./resolve-entities";

export type SasaReturn = { taskId: string; leadId: string; leadName: string; title: string; dueAt: Date | null };
export type SasaWaiting = { leadId: string; name: string; context: string; urgent: boolean };
export type SasaDuty = { name: string; startsAt: Date; endsAt: Date; paused?: boolean };

/** O que o Sasá enxerga do corretor: carregado pelo servidor só com os dados dele (tenant e usuário da sessão). */
export type SasaWorld = {
  now: Date;
  availability: "available" | "paused" | "offline";
  leads: SasaLead[];
  returns: SasaReturn[];
  waiting: SasaWaiting[];
  duty: { active: SasaDuty | null; next: SasaDuty | null };
  /** Fase 5: ofertas de lead novo esperando aceite (aceitar/recusar pelo Sasá). */
  offers?: Array<{ leadId: string; name: string; expiresAt: Date }>;
  /** Recuperação (fase 5): leads da carteira parados numa etapa de negociação e sem retorno marcado. */
  recover?: Array<{ leadId: string; name: string; status: string; since: Date | null }>;
};

export type SasaActionResult = { ok: boolean; message: string; warning?: boolean; undo?: { label: string; action: { kind: "server"; name: ChatServerActionName; payload: Record<string, string> } } };
export type SasaRun = (name: ChatServerActionName, payload: Record<string, string>) => Promise<SasaActionResult>;

/** Resposta ao corretor. `handled: false` = não é um pedido da fase 1 (segue para a resposta por IA). */
export type SasaReply = {
  handled: boolean;
  blocks: ChatBlock[];
  /** "plan" = vários passos numa frase (fase 5). */
  tool?: SasaIntent["tool"] | "plan";
  /** Rodou uma ação de escrita: o nome dela e se o servidor confirmou (para o feedback de nível 1). */
  executed?: { action: ChatServerActionName; ok: boolean; warning?: boolean };
  /** Fase 4: a tela guarda o rascunho no aparelho e abre a venda ou a cotação já preenchida. */
  open?: SasaOpen;
};

export type SasaCommandInput = {
  text: string;
  /** Escolhido por toque depois de "Qual Carlos?". O servidor só aceita um id que esteja em `world.leads`. */
  pickedLeadId?: string | null;
  clientCommandId?: string | null;
  /** Escrito ou falado (a voz já chegou transcrita). */
  origin?: "text" | "voice" | null;
};

/**
 * Fase 5: ações que um plano de vários passos pode juntar num toque (só as reversíveis e os Desfazer delas).
 * O servidor confere cada passo de novo (`sasa.plan` em chat-actions), com as checagens da ação de sempre.
 */
export const SASA_PLAN_ACTIONS = [
  "lead.addNote", "lead.scheduleReturn", "lead.changeStep", "lead.completeReturn", "lead.cancelReturn", "duty.pause", "duty.resume",
  "lead.undoReturn", "lead.reopenReturn", "lead.restoreStep",
] as const satisfies readonly ChatServerActionName[];
const PLAN_TOOLS = new Set<SasaTool>(["lead.note", "returns.schedule", "returns.complete", "returns.cancel", "lead.stage", "duty.pause", "duty.resume"]);
const MAX_PLAN_STEPS = 3;

/** O pedido como sai do aparelho: a hora da gravação viaja como texto ISO. */
export type SasaClientCommand = SasaCommandInput & { recordedAt?: string | null };
/** No servidor: quando foi gravado (fila sem internet). "daqui a 1 hora" conta daqui; mais de 30 min pede confirmação. */
type SasaTimedInput = SasaCommandInput & { recordedAt?: Date | null };

/** Regra dos 30 minutos (plano §3.6): pedido de escrita que chega atrasado não executa sozinho. */
export const SASA_LATE_MINUTES = 30;
export function sasaArrivedLate(recordedAt: Date | null | undefined, now: Date) {
  return Boolean(recordedAt && now.getTime() - recordedAt.getTime() > SASA_LATE_MINUTES * 60_000);
}

/** "Deixar pra lá" na confirmação de um pedido atrasado. */
export const SASA_DROP_VALUE = "sasa-drop";

/** Valor de uma escolha local que repete o pedido com o lead escolhido. */
export const SASA_PICK_PREFIX = "sasa:";
export function sasaPickValue(text: string, leadId: string) {
  return `${SASA_PICK_PREFIX}${JSON.stringify({ t: text, l: leadId })}`;
}
export function readSasaPick(value: string): { text: string; leadId: string | null } | null {
  if (!value.startsWith(SASA_PICK_PREFIX)) return null;
  try {
    const data = JSON.parse(value.slice(SASA_PICK_PREFIX.length)) as { t?: unknown; l?: unknown };
    return typeof data.t === "string" ? { text: data.t.slice(0, 500), leadId: typeof data.l === "string" ? data.l : null } : null;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<string, string> = {
  new: "Novo", distributed: "Aguardando atendimento", in_contact: "Em atendimento", contacted: "Entrei em contato", quote_sent: "Cotação enviada", negotiation: "Em negociação",
  documentation_pending: "Documentação pendente", under_analysis: "Em análise", awaiting_reply: "Aguardando resposta",
};

const initialsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("");

const sasaSay = (id: string, text: string): ChatBlock => ({ type: "assistant", id, text });

/** O mundo do Sasá a partir dos dados do dia que o app já carrega para o corretor. */
export function sasaWorldOf(data: BrokerWorkspaceData, now: Date): SasaWorld {
  const waitingKinds = new Set(["new_lead", "sla_risk", "sla_overdue", "awaiting_response"]);
  return {
    now,
    availability: data.viewer.availabilityStatus,
    leads: data.queue.map((lead) => ({ id: lead.id, name: lead.name, status: lead.status })),
    returns: data.agenda.map((item) => ({ taskId: item.id, leadId: item.leadId, leadName: item.leadName, title: item.title, dueAt: item.dueAt })),
    waiting: data.queue
      .filter((lead) => lead.nextAction && waitingKinds.has(lead.nextAction.kind))
      .map((lead) => ({
        leadId: lead.id,
        name: lead.name,
        context: lead.nextAction!.kind === "awaiting_response" ? "Respondeu e espera você" : lead.nextAction!.kind === "new_lead" ? "Lead novo esperando aceite" : "Esperando o 1º contato",
        urgent: lead.nextAction!.kind === "sla_overdue" || lead.nextAction!.kind === "sla_risk",
      })),
    duty: {
      active: data.duty?.active ? { name: data.duty.active.scheduleName, startsAt: data.duty.active.startsAt, endsAt: data.duty.active.endsAt, paused: data.duty.active.paused } : null,
      next: data.duty?.next ? { name: data.duty.next.scheduleName, startsAt: data.duty.next.startsAt, endsAt: data.duty.next.endsAt } : null,
    },
    offers: (data.pendingOffers ?? []).filter((offer) => offer.expiresAt.getTime() > now.getTime()).map((offer) => ({ leadId: offer.leadId, name: offer.name, expiresAt: offer.expiresAt })),
    recover: recoverListOf(data.queue, new Set(data.agenda.map((item) => item.leadId).filter((id): id is string => Boolean(id)))),
  };
}

type Plan =
  | { kind: "answer"; blocks: ChatBlock[]; open?: SasaOpen }
  /** Fase 5: encerra algo ou sai do app (aceitar, recusar, perder): confirma em um toque, nunca executa sozinho. */
  | { kind: "confirm"; prompt: string; confirm: ChatChoice; alternatives?: ChatChoice[] }
  /** Fase 5: rascunho de mensagem ao cliente; o corretor envia (D3). */
  | { kind: "draft"; leadId: string; name: string; message: string }
  | { kind: "run"; name: ChatServerActionName; payload: Record<string, string>; done: string; failed: string; /** O pedido como pergunta ("Marcar retorno com Ana amanhã às 10:00"). */ ask: string; /** Depois de feito: próximos passos sugeridos, um toque cada. */ then?: ChatBlock | null };

/** Etapa que a fala sugere, só quando é para a frente e diferente da atual. */
function stageFromSpeech(text: string, current: string): SasaStage | null {
  const said = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const order = ["new", "distributed", "in_contact", "contacted", "quote_sent", "negotiation", "documentation_pending"];
  const pick: SasaStage | null = /\b(document|rg|cpf|comprovante|carteirinha)/.test(said) ? "documentation_pending"
    : /\b(fechar|aceitou|topou|gostou|quer seguir|vai assinar|desconto|negociar|proposta)\b/.test(said) ? "negotiation"
      : /\b(recebeu a cotacao|viu a cotacao|olhou a cotacao)\b/.test(said) ? "quote_sent"
        : null;
  if (!pick || pick === current) return null;
  const from = order.indexOf(current);
  return from === -1 || order.indexOf(pick) > from ? pick : null;
}

/** Depois da nota: etapa e retorno sugeridos pela fala, um toque cada (D2: sugestão, nunca sozinho). */
function noteSuggestions(text: string, lead: SasaLead, world: SasaWorld, base: Date, stamp: string): ChatBlock | null {
  const choices: ChatChoice[] = [];
  const name = firstNameOf(lead.name);
  const stage = stageFromSpeech(text, lead.status);
  if (stage) choices.push({ id: "stage", label: `Mudar para ${SASA_STAGE_LABEL[stage]}`, action: { kind: "server", name: "lead.changeStep", payload: { leadId: lead.id, status: stage, previous: lead.status } } });
  const when = parseWhenPtBr(text, base);
  const said = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const open = openReturnsOf(world, lead.id)[0];
  if (when) {
    choices.push({ id: "return", label: `Retorno ${whenLabel(when.at, world.now)}`, action: { kind: "server", name: "lead.scheduleReturn", payload: { leadId: lead.id, at: when.at.toISOString(), ...(open ? { taskId: open.taskId } : {}) } } });
  } else if (/\b(vai pensar|vai ver|depois|retorn|me liga|ligar|semana que vem|amanha)\b/.test(said)) {
    choices.push({ id: "return", label: "Retorno amanhã às 9h", action: { kind: "server", name: "lead.scheduleReturn", payload: { leadId: lead.id, when: "tomorrow", ...(open ? { taskId: open.taskId } : {}) } } });
  }
  if (open && !when && /\b(liguei|falei|conversei|retornei)\b/.test(said)) choices.push({ id: "complete", label: "Concluir o retorno de hoje", action: { kind: "server", name: "lead.completeReturn", payload: { taskId: open.taskId, leadName: name } } });
  return choices.length ? { type: "question", id: `sasa-note-next-${stamp}`, prompt: `E com ${name}, quer também:`, choices } : null;
}

const said = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Motivo da recusa pela fala; sem pista, "Outro" com o que foi dito. */
export function declineReasonOf(text: string): string {
  const t = said(text);
  if (/\b(outra cidade|outro estado|outra regiao|fora do (meu )?perfil|nao atendo|nao e do meu|nao trabalho com)\b/.test(t)) return DECLINE_REASONS[2]!;
  if (/\b(muitos atendimentos|muita gente|cheio|lotad\w*)\b/.test(t)) return DECLINE_REASONS[1]!;
  if (/\b(sem disponibilidade|sem tempo|ocupad\w*|saindo|indo embora|de folga)\b/.test(t)) return DECLINE_REASONS[0]!;
  if (/\b(agora nao|nao consigo agora|nao da agora)\b/.test(t)) return DECLINE_REASONS[3]!;
  const rest = text.replace(/^\s*(sasa,?\s*)?(recusa|recusar|recuso|rejeita|rejeitar|dispensa|dispensar)\b[\s,.:;-]*/i, "").trim();
  return rest ? `Outro: ${rest}`.slice(0, 200) : DECLINE_REASONS[4]!;
}

/** Motivo de perda pela fala (MOTIVOS_PERDA). O preço vence "desistiu": "desistiu, achou caro" é preço. */
export function lostReasonOf(text: string): MotivoPerda {
  const t = said(text);
  if (/\b(mais barato|outra corretora|concorren\w*)\b/.test(t)) return "encontrou_mais_barato";
  if (/\b(caro|preco|valor alto|nao cabe no bolso|muito alto)\b/.test(t)) return "preco";
  if (/\b(ja contratou|ja tem plano|fechou com outr\w*|contratou com outr\w*)\b/.test(t)) return "ja_contratou";
  if (/\bcarencia\b/.test(t)) return "carência";
  if (/\b(saude|doenca|cirurgia|tratamento)\b/.test(t)) return "problema_saude";
  if (/\b(nao qualificad\w*|nao tem cnpj|nao se encaixa)\b/.test(t)) return "nao_qualificado";
  if (/\b(sumiu|nao responde|sem contato|nao atende)\b/.test(t)) return "sem_contato";
  if (/\b(sem interesse|nao quer mais|perdeu o interesse)\b/.test(t)) return "sem_interesse";
  if (/\b(desistiu|desistiram)\b/.test(t)) return "desistiu";
  return "outro";
}

/** "manda pra Ana que a proposta sai amanhã" → "Oi, Ana! A proposta sai amanhã." */
export function draftMessageOf(text: string, firstName: string): string | null {
  const match = text.match(/\b(?:que|dizendo|falando|avisando)\b[\s:,]*(.+)$/i);
  const body = match?.[1]?.trim().replace(/\s+/g, " ");
  if (!body) return null;
  const sentence = body.charAt(0).toLocaleUpperCase("pt-BR") + body.slice(1);
  return `Oi, ${firstName}! ${/[.!?]$/.test(sentence) ? sentence : `${sentence}.`}`;
}

/** A oferta do pedido: pelo nome; sem nome e com uma só, ela; com várias, a escolha por toque. */
function offerOf(input: SasaTimedInput, world: SasaWorld, stamp: string, hint: string | null): { lead: SasaLead } | { plan: Plan } {
  const offers = (world.offers ?? []).map((offer) => ({ id: offer.leadId, name: offer.name, status: "new" }));
  if (!offers.length) return { plan: { kind: "answer", blocks: [sasaSay(`sasa-no-offer-${stamp}`, "Você não tem lead novo esperando aceite agora.")] } };
  if (input.pickedLeadId) {
    const lead = offers.find((item) => item.id === input.pickedLeadId);
    return lead ? { lead } : { plan: { kind: "answer", blocks: [sasaSay(`sasa-offer-gone-${stamp}`, "Essa oferta não está mais com você. Nada foi alterado.")] } };
  }
  const match = resolveLead(input.text, offers, hint);
  if (match.kind === "one") return { lead: match.lead };
  const named = hint ?? nameHintOf(input.text);
  if (match.kind === "none" && offers.length === 1 && !named) return { lead: offers[0]! };
  if (match.kind === "none" && named) return { plan: { kind: "answer", blocks: [sasaSay(`sasa-offer-none-${stamp}`, `${named} não está entre as ofertas para você agora. Nada foi alterado.`)] } };
  const options = match.kind === "many" ? match.leads : offers.slice(0, 4);
  return { plan: { kind: "answer", blocks: [{ type: "question", id: `sasa-offer-pick-${stamp}`, prompt: "Qual lead?", choices: options.map((lead) => ({ id: `pick-${lead.id}`, label: lead.name, reply: lead.name, action: { kind: "local" as const, value: sasaPickValue(input.text, lead.id) } })) }] } };
}

const dropChoice = (label = "Deixar pra lá"): ChatChoice => ({ id: "drop", label, reply: label, action: { kind: "local", value: SASA_DROP_VALUE } });

function dayDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" }).format(date);
}

function dutyAnswer(world: SasaWorld, stamp: string): Plan {
  const { active, next } = world.duty;
  const lines: string[] = [];
  if (active) lines.push(`Você está no plantão ${active.name}, das ${clockLabel(active.startsAt)} às ${clockLabel(active.endsAt)}${active.paused || world.availability === "paused" ? ", com o recebimento pausado" : ""}.`);
  if (next) lines.push(`${active ? "O próximo" : "Seu próximo plantão"} é ${next.name}, ${dayDate(next.startsAt)}, das ${clockLabel(next.startsAt)} às ${clockLabel(next.endsAt)}.`);
  if (!lines.length) lines.push("Você não tem plantão marcado. Quando o supervisor colocar você na escala, ele aparece em Plantões.");
  return {
    kind: "answer",
    blocks: [
      sasaSay(`sasa-duty-${stamp}`, lines.join(" ")),
      { type: "question", id: `sasa-duty-open-${stamp}`, prompt: "Quer ver a escala?", choices: [{ id: "open-duty", label: "Ver plantões", action: { kind: "href", href: "/plantoes" } }] },
    ],
  };
}

/** Ordem de quem recuperar: quem está mais perto de fechar primeiro, e o mais antigo antes. */
const RECOVER_ORDER = ["negotiation", "quote_sent", "awaiting_reply", "contacted", "in_contact"];

export function recoverListOf(queue: ReadonlyArray<{ id: string; name: string; status: string; arrivedAt: Date | null }>, withReturn: ReadonlySet<string>) {
  return queue
    .filter((lead) => RECOVER_ORDER.includes(lead.status) && !withReturn.has(lead.id))
    .sort((a, b) => RECOVER_ORDER.indexOf(a.status) - RECOVER_ORDER.indexOf(b.status) || (a.arrivedAt?.getTime() ?? 0) - (b.arrivedAt?.getTime() ?? 0))
    .map((lead) => ({ leadId: lead.id, name: lead.name, status: lead.status, since: lead.arrivedAt }));
}

function recoverAnswer(world: SasaWorld, stamp: string): Plan {
  const list = world.recover ?? [];
  if (!list.length) return { kind: "answer", blocks: [sasaSay(`sasa-recover-${stamp}`, "Ninguém parado na sua carteira: todo lead em negociação tem retorno marcado.")] };
  const rows: ChatLeadRow[] = list.slice(0, 8).map((lead) => ({
    leadId: lead.leadId, name: lead.name, initials: initialsOf(lead.name), context: `${STATUS_LABEL[lead.status] ?? lead.status} · sem retorno marcado`,
    chip: { label: "Recuperar", tone: "warning" as const },
  }));
  const count = list.length;
  return {
    kind: "answer",
    blocks: [
      sasaSay(`sasa-recover-${stamp}`, `${count === 1 ? "1 lead está parado" : `${count} leads estão parados`} sem retorno marcado. Comece por ${firstNameOf(list[0]!.name)}: chame no WhatsApp e marque o próximo retorno.`),
      { type: "leads", id: `sasa-recover-list-${stamp}`, title: "Recuperar hoje", icon: "reply", rows, emptyText: "Ninguém parado.", updatedAt: clockLabel(world.now) },
    ],
  };
}

function waitingAnswer(world: SasaWorld, stamp: string): Plan {
  if (!world.waiting.length) return { kind: "answer", blocks: [sasaSay(`sasa-waiting-${stamp}`, "Ninguém está esperando por você agora. Quando um lead responder, eu mostro aqui.")] };
  const ordered = [...world.waiting].sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const rows: ChatLeadRow[] = ordered.slice(0, 8).map((lead) => ({
    leadId: lead.leadId, name: lead.name, initials: initialsOf(lead.name), context: lead.context,
    ...(lead.urgent ? { chip: { label: "Atrasando", tone: "warning" as const } } : {}),
  }));
  const count = ordered.length;
  return {
    kind: "answer",
    blocks: [
      sasaSay(`sasa-waiting-${stamp}`, `${count === 1 ? "1 pessoa está" : `${count} pessoas estão`} esperando você. Comece por ${firstNameOf(ordered[0]!.name)}.`),
      { type: "leads", id: `sasa-waiting-list-${stamp}`, title: "Esperando você", icon: "reply", rows, emptyText: "Ninguém esperando.", updatedAt: clockLabel(world.now) },
    ],
  };
}

function agendaAnswer(world: SasaWorld, stamp: string): Plan {
  const endOfToday = parseWhenPtBr("hoje às 23:59", world.now)?.at ?? world.now;
  const items = world.returns
    .filter((item) => !item.dueAt || item.dueAt.getTime() <= endOfToday.getTime())
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  if (!items.length) {
    const later = world.returns.filter((item) => item.dueAt).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0];
    return { kind: "answer", blocks: [sasaSay(`sasa-agenda-${stamp}`, later ? `Hoje está livre. O próximo retorno é com ${firstNameOf(later.leadName)}, ${whenLabel(later.dueAt!, world.now)}.` : "Sua agenda está livre. Para marcar, é só dizer: \"marca retorno com a Ana amanhã às 10\".")] };
  }
  const late = items.filter((item) => item.dueAt && item.dueAt.getTime() < world.now.getTime()).length;
  return {
    kind: "answer",
    blocks: [
      sasaSay(`sasa-agenda-${stamp}`, `Hoje você tem ${items.length === 1 ? "1 retorno" : `${items.length} retornos`}${late ? `, ${late === 1 ? "1 atrasado" : `${late} atrasados`}` : ""}.`),
      {
        type: "list", id: `sasa-agenda-list-${stamp}`, title: "Sua agenda",
        items: items.slice(0, 8).map((item) => ({
          id: item.taskId, lead: item.leadId, primary: item.leadName, secondary: item.title,
          trailing: item.dueAt ? (item.dueAt.getTime() < world.now.getTime() ? `Atrasado · ${clockLabel(item.dueAt)}` : clockLabel(item.dueAt)) : "Sem hora",
          href: `/leads/${item.leadId}`,
        })),
      },
    ],
  };
}

/** Resolve o lead do pedido; em dúvida ou sem achar, devolve a pergunta a fazer. */
function leadOf(input: SasaTimedInput, world: SasaWorld, stamp: string, hint: string | null): { lead: SasaLead } | { plan: Plan } {
  if (input.pickedLeadId) {
    const lead = world.leads.find((item) => item.id === input.pickedLeadId);
    if (lead) return { lead };
    return { plan: { kind: "answer", blocks: [sasaSay(`sasa-lead-gone-${stamp}`, "Esse lead não está mais com você. Nada foi alterado.")] } };
  }
  const match = resolveLead(input.text, world.leads, hint);
  if (match.kind === "one") return { lead: match.lead };
  if (match.kind === "many") {
    const choices: ChatChoice[] = match.leads.map((lead) => ({ id: `pick-${lead.id}`, label: lead.name, hint: STATUS_LABEL[lead.status] ?? undefined, reply: lead.name, action: { kind: "local", value: sasaPickValue(input.text, lead.id) } }));
    return { plan: { kind: "answer", blocks: [{ type: "question", id: `sasa-pick-${stamp}`, prompt: `Qual ${firstNameOf(match.leads[0]!.name)}?`, choices }] } };
  }
  const name = hint ?? nameHintOf(input.text);
  return {
    plan: {
      kind: "answer",
      blocks: [
        sasaSay(`sasa-lead-none-${stamp}`, name ? `Não achei ${name} entre os seus leads. Nada foi alterado.` : "De qual lead você está falando? Diga o nome, por exemplo: \"marca retorno com a Ana amanhã às 10\"."),
        { type: "question", id: `sasa-lead-none-open-${stamp}`, prompt: "Quer procurar na lista?", choices: [{ id: "open-queue", label: "Ver meus leads", action: { kind: "href", href: "/minha-fila" } }] },
      ],
    },
  };
}

function openReturnsOf(world: SasaWorld, leadId: string) {
  return world.returns.filter((item) => item.leadId === leadId).sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
}

function plan(intent: SasaIntent, input: SasaTimedInput, world: SasaWorld, stamp: string, hint: string | null, whenText: string | null): Plan {
  switch (intent.tool) {
    case "duty.next": return dutyAnswer(world, stamp);
    case "leads.waiting": return waitingAnswer(world, stamp);
    case "leads.recover": return recoverAnswer(world, stamp);
    case "agenda.list": return agendaAnswer(world, stamp);
    case "duty.pause":
      if (world.availability === "paused") return { kind: "answer", blocks: [sasaSay(`sasa-paused-${stamp}`, "Você já está pausado. Para voltar, diga \"volta a receber\".")] };
      return { kind: "run", name: "duty.pause", payload: {}, done: "Pausei. Você não recebe leads novos até voltar.", failed: "Não consegui pausar. Você continua recebendo.", ask: "Pausar o recebimento de leads" };
    case "duty.resume":
      if (world.availability === "available") return { kind: "answer", blocks: [sasaSay(`sasa-available-${stamp}`, "Você já está recebendo leads.")] };
      return { kind: "run", name: "duty.resume", payload: {}, done: "Pronto, você voltou a receber leads.", failed: "Não consegui voltar você. Seu recebimento continua pausado.", ask: "Voltar a receber leads" };
    case "returns.schedule": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const lead = found.lead;
      const name = firstNameOf(lead.name);
      const replace = intent.reschedule ? openReturnsOf(world, lead.id)[0] : undefined;
      // Fila sem internet: "daqui a 1 hora" conta da hora em que foi gravado.
      const when = parseWhenPtBr(whenText ?? input.text, input.recordedAt ?? world.now);
      if (!when) {
        const presets: Array<[string, string]> = [["today", "Hoje às 18h"], ["tomorrow", "Amanhã às 9h"], ["in_2_days", "Daqui a 2 dias"]];
        return {
          kind: "answer",
          blocks: [{
            type: "question", id: `sasa-when-${stamp}`, prompt: `Para quando o retorno com ${name}?`,
            choices: presets.map(([value, label]) => ({ id: `when-${value}`, label, action: { kind: "server", name: "lead.scheduleReturn", payload: { leadId: lead.id, when: value, ...(replace ? { taskId: replace.taskId } : {}) } } })),
          }],
        };
      }
      const label = whenLabel(when.at, world.now);
      return {
        kind: "run", name: "lead.scheduleReturn",
        payload: { leadId: lead.id, at: when.at.toISOString(), ...(replace ? { taskId: replace.taskId } : {}) },
        done: `${replace ? "Remarquei" : "Combinado"}: retorno com ${name} ${label}. Está na sua Agenda.`,
        failed: `Não consegui marcar o retorno com ${name}. Nada foi alterado.`,
        ask: `${replace ? "Remarcar" : "Marcar"} retorno com ${name} ${label}`,
      };
    }
    case "returns.complete":
    case "returns.cancel": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const name = firstNameOf(found.lead.name);
      const open = openReturnsOf(world, found.lead.id)[0];
      if (!open) return { kind: "answer", blocks: [sasaSay(`sasa-no-return-${stamp}`, `${name} não tem retorno aberto na sua Agenda.`)] };
      return intent.tool === "returns.complete"
        ? { kind: "run", name: "lead.completeReturn", payload: { taskId: open.taskId, leadName: name }, done: `Boa. Tirei o retorno com ${name} da sua Agenda.`, failed: `Não consegui concluir o retorno com ${name}. Ele continua na Agenda.`, ask: `Concluir o retorno com ${name}` }
        : { kind: "run", name: "lead.cancelReturn", payload: { taskId: open.taskId, leadName: name }, done: `Cancelei o retorno com ${name}.`, failed: `Não consegui cancelar o retorno com ${name}. Ele continua na Agenda.`, ask: `Cancelar o retorno com ${name}` };
    }
    case "sale.start": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const name = firstNameOf(found.lead.name);
      const draft = parseSpokenSale(whenText ? `${input.text} ${whenText}` : input.text, input.recordedAt ?? world.now);
      const href = `/leads/${encodeURIComponent(found.lead.id)}/registrar-venda`;
      const heard = [draft.planType ? `tipo ${draft.planType === "pme" ? "PME" : draft.planType}` : null, draft.ages ? (draft.ages.length === 1 ? `${draft.ages[0]} anos` : `${draft.ages.length} vidas`) : null, draft.monthlyValue ? `R$ ${draft.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null].filter(Boolean);
      return {
        kind: "answer",
        open: { kind: "sale", leadId: found.lead.id, href, draft },
        blocks: [
          sasaSay(`sasa-sale-${stamp}`, `Boa! Abrindo o registro da venda de ${name}${heard.length ? ` com o que você disse: ${heard.join(", ")}` : ""}. Lá eu pergunto só o que faltar.`),
          { type: "question", id: `sasa-sale-open-${stamp}`, prompt: "Se não abrir sozinho:", choices: [{ id: "open-sale", label: "Registrar a venda", action: { kind: "href", href } }] },
        ],
      };
    }
    case "quote.start": {
      const draft = parseSpokenQuote(input.text);
      const lives = draft.ages?.length;
      return {
        kind: "answer",
        open: { kind: "quote", href: "/cotacao", draft },
        blocks: [
          sasaSay(`sasa-quote-${stamp}`, lives ? `Abrindo a cotação com ${lives === 1 ? `1 vida (${draft.ages![0]} anos)` : `${lives} vidas (${draft.ages!.join(", ")} anos)`}. Lá eu pergunto o resto.` : "Abrindo a cotação. Lá eu pergunto quem vai entrar no plano."),
          { type: "question", id: `sasa-quote-open-${stamp}`, prompt: "Se não abrir sozinho:", choices: [{ id: "open-quote", label: "Fazer a cotação", action: { kind: "href", href: "/cotacao" } }] },
        ],
      };
    }
    case "lead.note": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const lead = found.lead;
      const name = firstNameOf(lead.name);
      const asked = input.text.trim().replace(/^(sasa,?\s*)?(anota|anotar|anote|registra|registrar|nota)(\s+a[ií])?(\s+que)?\s+/i, "");
      const content = (asked ? asked.charAt(0).toLocaleUpperCase("pt-BR") + asked.slice(1) : input.text.trim()).slice(0, 2000);
      return {
        kind: "run", name: "lead.addNote", payload: { leadId: lead.id, content },
        done: `Anotei no histórico de ${name}.`, failed: `Não consegui anotar no histórico de ${name}. Nada foi salvo.`, ask: `Anotar no histórico de ${name}: "${content}"`,
        then: noteSuggestions(content, lead, world, input.recordedAt ?? world.now, stamp),
      };
    }
    case "lead.accept": {
      const found = offerOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const name = firstNameOf(found.lead.name);
      return {
        kind: "confirm",
        prompt: `Aceitar ${found.lead.name}? O WhatsApp do cliente abre com a mensagem pronta.`,
        confirm: { id: "confirm", label: "Aceitar", reply: `Aceitar ${name}`, action: { kind: "server", name: "lead.accept", payload: { leadId: found.lead.id } } },
      };
    }
    case "lead.decline": {
      const found = offerOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const reason = declineReasonOf(input.text);
      const name = firstNameOf(found.lead.name);
      const others = DECLINE_REASONS.filter((item) => item !== reason && item !== "Outro").slice(0, 2);
      return {
        kind: "confirm",
        prompt: `Recusar ${found.lead.name}? Motivo: ${reason}. Ele volta para a fila e vai para outro corretor.`,
        confirm: { id: "confirm", label: "Recusar", reply: `Recusar ${name}`, action: { kind: "server", name: "lead.decline", payload: { leadId: found.lead.id, reason } } },
        alternatives: others.map((item, index) => ({ id: `reason-${index}`, label: `Recusar: ${item}`, reply: `Recusar ${name}: ${item}`, action: { kind: "server" as const, name: "lead.decline" as const, payload: { leadId: found.lead.id, reason: item } } })),
      };
    }
    case "lead.lost": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const reason = lostReasonOf(input.text);
      const name = firstNameOf(found.lead.name);
      return {
        kind: "confirm",
        prompt: `Encerrar o atendimento de ${found.lead.name} como perdido? Motivo: ${MOTIVO_PERDA_LABELS[reason]}.`,
        confirm: { id: "confirm", label: "Encerrar", reply: `Encerrar ${name}`, action: { kind: "server", name: "lead.markLost", payload: { leadId: found.lead.id, reason, previous: found.lead.status } } },
      };
    }
    case "message.draft": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const name = firstNameOf(found.lead.name);
      const message = draftMessageOf(input.text, name);
      if (!message) return { kind: "answer", blocks: [sasaSay(`sasa-draft-empty-${stamp}`, `O que você quer dizer para ${name}? Por exemplo: "manda pra ${name} que a proposta sai amanhã".`)] };
      return { kind: "draft", leadId: found.lead.id, name, message: message.slice(0, 600) };
    }
    case "lead.stage": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const name = firstNameOf(found.lead.name);
      const stage = SASA_STAGE_LABEL[intent.status];
      if (found.lead.status === intent.status) return { kind: "answer", blocks: [sasaSay(`sasa-same-stage-${stamp}`, `${name} já está em ${stage}.`)] };
      return { kind: "run", name: "lead.changeStep", payload: { leadId: found.lead.id, status: intent.status, previous: found.lead.status }, done: `Pronto: ${name} agora está em ${stage}.`, failed: `Não consegui mudar a etapa de ${name}. Ela continua como estava.`, ask: `Mudar ${name} para ${stage}` };
    }
  }
}

/**
 * Fase 5 (intenção 22): "anota que a Ana vai pensar e marca retorno pra sexta às 10" vira uma lista confirmada em um
 * toque. Só junta pedidos reversíveis; o lead dito num passo vale para os outros ("ela"). Sem casar todos os passos,
 * devolve null e o pedido segue como um só.
 */
function planSteps(steps: string[], input: SasaTimedInput & { world: SasaWorld }, stamp: string): SasaReply | null {
  const intents = steps.map((step) => classifySasaText(step));
  if (intents.some((intent) => !intent || !PLAN_TOOLS.has(intent.tool))) return null;
  const world = input.world;
  let leadId = input.pickedLeadId ?? null;
  if (!leadId) {
    const matches = steps.map((step) => resolveLead(step, world.leads));
    const one = matches.find((match) => match.kind === "one");
    if (one?.kind === "one") leadId = one.lead.id;
    else if (intents.some((intent) => intent!.tool !== "duty.pause" && intent!.tool !== "duty.resume")) {
      const found = leadOf(input, world, stamp, null);
      if ("plan" in found && found.plan.kind === "answer") return { handled: true, tool: "plan", blocks: found.plan.blocks };
      if ("lead" in found) leadId = found.lead.id;
    }
  }
  const runs: Array<Extract<Plan, { kind: "run" }>> = [];
  for (const [index, step] of steps.slice(0, MAX_PLAN_STEPS).entries()) {
    const next = plan(intents[index]!, { ...input, text: step, pickedLeadId: leadId }, world, `${stamp}-${index}`, null, null);
    // Um passo que precisa perguntar (quando? qual lead?) pergunta antes; nada roda pela metade.
    if (next.kind === "answer") return { handled: true, tool: "plan", blocks: next.blocks };
    if (next.kind !== "run") return null;
    runs.push(next);
  }
  const list = runs.map((run, index) => `${index + 1}) ${run.ask}`).join("; ");
  return {
    handled: true,
    tool: "plan",
    blocks: [{
      type: "question", id: `sasa-plan-${stamp}`, prompt: `Vou fazer ${runs.length} coisas: ${list}. Confirma?`,
      choices: [
        { id: "confirm", label: "Fazer tudo", reply: "Fazer tudo", action: { kind: "server", name: "sasa.plan", payload: { steps: JSON.stringify(runs.map((run) => ({ name: run.name, payload: run.payload, label: run.ask }))) } } },
        dropChoice(),
      ],
    }],
  };
}

/**
 * Roda um pedido. `intent` vem da IA quando as regras não casaram; sem ela, só as regras.
 * Sucesso só depois da confirmação do servidor; erro diz o que continua valendo e oferece "Tentar de novo".
 */
export async function runSasaCommand(input: SasaTimedInput & {
  world: SasaWorld;
  run: SasaRun;
  intent?: SasaIntent | null;
  leadHint?: string | null;
  whenText?: string | null;
  stamp?: string;
  /** Fase 5: telefone do lead para o rascunho, só quando o contato pode ser revelado ao corretor. */
  contactOf?: (leadId: string) => Promise<string | null>;
}): Promise<SasaReply> {
  const stamp = input.stamp ?? String(input.world.now.getTime());
  if (!input.intent) {
    const steps = splitSasaSteps(input.text);
    if (steps.length > 1) {
      const multi = planSteps(steps, input, stamp);
      if (multi) return multi;
    }
  }
  const intent = input.intent ?? classifySasaText(input.text);
  if (!intent) return { handled: false, blocks: [] };
  const next = plan(intent, input, input.world, stamp, input.leadHint ?? null, input.whenText ?? null);
  if (next.kind === "answer") return { handled: true, tool: intent.tool, blocks: next.blocks, ...(next.open ? { open: next.open } : {}) };
  if (next.kind === "confirm") {
    return { handled: true, tool: intent.tool, blocks: [{ type: "question", id: `sasa-confirm-${stamp}`, prompt: next.prompt, choices: [next.confirm, ...(next.alternatives ?? []), dropChoice()] }] };
  }
  if (next.kind === "draft") {
    const phone = await input.contactOf?.(next.leadId).catch(() => null) ?? null;
    const choices: ChatChoice[] = phone
      ? [{ id: "open-whatsapp", label: "Abrir no WhatsApp", action: { kind: "href", href: buildWhatsAppWebUrl(phone, next.message) } }]
      : [{ id: "open-lead", label: `Abrir a ficha de ${next.name}`, action: { kind: "href", href: `/leads/${encodeURIComponent(next.leadId)}` } }];
    return {
      handled: true,
      tool: intent.tool,
      blocks: [
        sasaSay(`sasa-draft-${stamp}`, `Rascunho para ${next.name}: "${next.message}"`),
        { type: "question", id: `sasa-draft-open-${stamp}`, prompt: phone ? "Eu não envio sozinha: confira e envie você." : `O contato de ${next.name} ainda não está liberado para você. Copie o texto e envie pela ficha.`, choices },
      ],
    };
  }
  if (sasaArrivedLate(input.recordedAt, input.world.now)) {
    // Gravado sem internet há mais de 30 min: o corretor confirma num toque (a ação roda pelo mesmo caminho do chat).
    const at = clockLabel(input.recordedAt!);
    return {
      handled: true,
      tool: intent.tool,
      blocks: [{
        type: "question", id: `sasa-late-${stamp}`, prompt: `Você gravou às ${at}, sem internet. ${next.ask}?`,
        choices: [
          { id: "confirm", label: "Confirmar", reply: "Confirmar", action: { kind: "server", name: next.name, payload: next.payload } },
          { id: "drop", label: "Deixar pra lá", reply: "Deixar pra lá", action: { kind: "local", value: SASA_DROP_VALUE } },
        ],
      }],
    };
  }

  let result: SasaActionResult;
  try {
    result = await input.run(next.name, next.payload);
  } catch {
    result = { ok: false, message: next.failed };
  }
  const retry: ChatBlock = {
    type: "question", id: `sasa-retry-${stamp}`, prompt: "Quer tentar de novo?",
    choices: [{ id: "retry", label: "Tentar de novo", reply: input.text, action: { kind: "local", value: sasaPickValue(input.text, input.pickedLeadId ?? "") } }],
  };
  if (!result.ok) return { handled: true, tool: intent.tool, executed: { action: next.name, ok: false }, blocks: [sasaSay(`sasa-failed-${stamp}`, next.failed), retry] };
  const blocks: ChatBlock[] = [sasaSay(`sasa-done-${stamp}`, result.warning ? result.message : next.done)];
  if (result.undo) blocks.push({ type: "question", id: `sasa-undo-${stamp}`, prompt: "Foi sem querer?", choices: [{ id: "undo", label: result.undo.label, action: result.undo.action }] });
  if (next.then) blocks.push(next.then);
  return { handled: true, tool: intent.tool, executed: { action: next.name, ok: true, warning: result.warning }, blocks };
}
