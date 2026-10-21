import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import type { BrokerJourneyData, JourneyCelebration } from "@/features/engagement/journey-types";
import type {
  AssistantId,
  ChatBlock,
  ChatChoice,
  ChatScript,
  MascotShape,
  PresenceAskView,
  ThreadSummary,
} from "@/components/chat/types";
import type { BrokerWorkspacePriority } from "@/features/broker-workspace/priority";
import { DECLINE_REASONS } from "@/features/broker-workspace/components/light-lead-detail/types";
import { isQuotePausedFor } from "../quote-availability";

const TIME_ZONE = "America/Sao_Paulo";

type AssistantDefinition = {
  name: string;
  shape: MascotShape;
  hue: number | null;
  verified?: boolean;
  href: string;
};

export const ASSISTANTS: Record<AssistantId, AssistantDefinition> = {
  ancora: { name: "Jack", shape: "jack", hue: 175, verified: true, href: "/dashboard/c/ancora" },
  leads: { name: "Meus Leads", shape: "mochi", hue: 212, href: "/minha-fila" },
  plantao: { name: "Plantão", shape: "onigiri", hue: 28, href: "/plantoes/agora" },
  agenda: { name: "Agenda", shape: "cubo", hue: 150, href: "/agenda" },
  cotacao: { name: "Cotação", shape: "favo", hue: 268, href: "/cotacao" },
  desempenho: { name: "Desempenho", shape: "nuvem", hue: 330, href: "/desempenho" },
  insights: { name: "Dicas de Atendimento", shape: "salte", hue: 200, href: "/conversas/broker" },
  jornada: { name: "Jornada", shape: "favo", hue: 85, href: "/jornada" },
  equipe: { name: "Equipe", shape: "mochi", hue: 150, href: "/equipe/minha" },
  "equipe-leads": { name: "Leads da equipe", shape: "cubo", hue: 212, href: "/leads" },
  "equipe-plantao": { name: "Plantão da equipe", shape: "onigiri", hue: 28, href: "/equipe/plantao" },
  "equipe-desempenho": { name: "Desempenho da equipe", shape: "nuvem", hue: 330, href: "/equipe/desempenho" },
};

/** Assistants that only exist in the supervisor Lite. */
export const SUPERVISOR_ASSISTANTS = ["equipe", "equipe-leads", "equipe-plantao", "equipe-desempenho"] as const;

type LeadQueueItem = BrokerWorkspaceData["queue"][number];
type ScriptAssistantId = Exclude<AssistantId, "ancora" | "cotacao" | "insights" | "equipe" | "equipe-leads" | "equipe-plantao" | "equipe-desempenho">;

function iso(date: Date | null | undefined) {
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function latestIso(dates: Array<Date | null | undefined>) {
  const latest = dates
    .filter((date): date is Date => Boolean(date && Number.isFinite(date.getTime())))
    .sort((left, right) => right.getTime() - left.getTime())[0];
  return iso(latest);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("");
}

function minutesSince(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
}

export function actionPreview(action: BrokerWorkspacePriority, now: Date) {
  const name = action.title;
  switch (action.kind) {
    case "new_lead":
      return `Chegou ${name}. Está aguardando seu aceite.`;
    case "sla_risk":
    case "sla_overdue":
      return `${name} espera seu 1º contato há ${minutesSince(action.referenceAt, now)} min.`;
    case "awaiting_response":
      return `${name} respondeu e espera sua mensagem.`;
    case "return_due":
      return action.dueAt && action.dueAt.getTime() <= now.getTime()
        ? `Retorno vencido para ${name}.`
        : `Retorno de ${name} agendado.`;
    case "task_overdue":
      return `Tarefa vencida para ${name}.`;
    case "proposal_pending":
      return `A cotação de ${name} aguarda acompanhamento.`;
    case "document_pending":
      return `Há documentos pendentes para ${name}.`;
    case "follow_up_stalled":
      return `A negociação com ${name} precisa avançar.`;
  }
}

function isWaitingPriority(action: BrokerWorkspacePriority | null, now: Date) {
  if (!action) return false;
  if (action.kind === "new_lead" || action.kind === "sla_risk" || action.kind === "sla_overdue" || action.kind === "awaiting_response" || action.kind === "task_overdue") return true;
  return action.kind === "return_due" && Boolean(action.dueAt && action.dueAt.getTime() <= now.getTime());
}

function threadForLead(lead: LeadQueueItem, now: Date): ThreadSummary {
  const action = lead.nextAction;
  const waitingYou = isWaitingPriority(action, now);
  const unread = action?.kind === "new_lead" || action?.kind === "awaiting_response" || lead.status === "new" || lead.status === "distributed";
  const statusPreview: Record<string, string> = {
    new: "Lead novo, aguardando seu aceite.",
    distributed: "Lead aguardando o primeiro atendimento.",
    in_contact: "Atendimento em andamento.",
    quote_sent: "Cotação enviada ao cliente.",
    negotiation: "Negociação em andamento.",
    documentation_pending: "Documentação pendente.",
    under_analysis: "Lead em análise.",
  };

  return {
    id: `lead:${lead.id}`,
    kind: "lead",
    leadId: lead.id,
    name: lead.name,
    preview: action ? actionPreview(action, now) : statusPreview[lead.status] ?? "Abra a conversa para ver o atendimento.",
    at: iso(lead.arrivedAt),
    unread,
    waitingYou,
    attention: action?.kind === "new_lead",
    href: `/leads/${lead.id}`,
    shape: "mochi",
    hue: null,
    initials: initials(lead.name),
    temperature: null,
  };
}

function assistantThread(id: AssistantId, values: Pick<ThreadSummary, "preview" | "at" | "unread" | "waitingYou"> & Partial<Pick<ThreadSummary, "attention">>): ThreadSummary {
  const assistant = ASSISTANTS[id];
  return {
    id: `assistant:${id}`,
    kind: "assistant",
    assistant: id,
    name: assistant.name,
    verified: assistant.verified,
    // Jack is pinned to the top: the one conversation where the broker writes.
    pinned: id === "ancora",
    href: assistant.href,
    shape: assistant.shape,
    hue: assistant.hue,
    ...values,
  };
}

function latestLeadPreview(leads: ThreadSummary[]) {
  return leads.find((lead) => lead.waitingYou || lead.unread) ?? leads[0] ?? null;
}

function localDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isOverdueReturn(data: BrokerWorkspaceData, now: Date) {
  return data.agenda.find((item) =>
    item.dueAt
    && item.dueAt.getTime() <= now.getTime()
    && /retorn|follow[ -]?up/i.test(item.title),
  ) ?? null;
}

function threadSort(left: ThreadSummary, right: ThreadSummary) {
  if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1;
  if (left.waitingYou !== right.waitingYou) return left.waitingYou ? -1 : 1;
  if (left.unread !== right.unread) return left.unread ? -1 : 1;
  const leftAt = left.at ? Date.parse(left.at) : Number.NEGATIVE_INFINITY;
  const rightAt = right.at ? Date.parse(right.at) : Number.NEGATIVE_INFINITY;
  return rightAt - leftAt || left.id.localeCompare(right.id);
}

export function buildAssistantThreads(input: {
  data: BrokerWorkspaceData;
  capabilities: { quoteSimulator: boolean; dutyCalendar: boolean; journey?: boolean };
  journey?: BrokerJourneyData | null;
  now: Date;
}): ThreadSummary[] {
  const { data, capabilities, now } = input;
  const leads = buildLeadThreads({ queue: data.queue, now });
  const leadPreview = latestLeadPreview(leads);
  const notification = data.inbox.find((item) => item.source === "notification");
  const activeDuty = data.duty?.active;
  const nextDuty = capabilities.dutyCalendar ? data.duty?.next : null;
  const overdueReturn = isOverdueReturn(data, now);
  const todayKey = localDateKey(now);
  const todayAgenda = data.agenda.filter((item) => item.dueAt && localDateKey(item.dueAt) === todayKey);
  const activeTime = activeDuty ? `${formatTime(activeDuty.startsAt)} às ${formatTime(activeDuty.endsAt)}` : null;

  const threads = [
    assistantThread("ancora", {
      preview: data.today.unreadNotifications > 0
        ? notification?.title ?? `Você tem ${data.today.unreadNotifications} avisos novos.`
        : "Você não tem avisos novos. Quando a escala mudar ou um lead precisar de você, o recado aparece aqui.",
      at: data.today.unreadNotifications > 0 ? iso(data.updatedAt) : null,
      unread: data.today.unreadNotifications > 0,
      waitingYou: false,
    }),
    assistantThread("leads", {
      preview: leadPreview?.preview ?? "Tudo em dia por aqui.",
      at: latestIso(leads.map((lead) => lead.at ? new Date(lead.at) : null)),
      unread: leads.some((lead) => lead.unread),
      waitingYou: leads.some((lead) => lead.waitingYou),
      attention: leads.some((lead) => lead.attention),
    }),
    assistantThread("plantao", {
      preview: data.duty?.presence?.status === "pending"
        ? data.duty.presence.mode === "presencial" ? `Confirme sua presença no ${data.duty.presence.scheduleName} com uma foto do local.` : `Confirme sua presença no ${data.duty.presence.scheduleName}.`
        : data.duty?.presence?.status === "awaiting_release"
        ? `Foto enviada. Aguardando o diretor liberar no ${data.duty.presence.scheduleName}.`
        : activeDuty
        ? activeDuty.presenceStatus === "pending"
          ? `Aguardando liberação do plantão ${activeDuty.scheduleName}.`
          : activeDuty.paused
            ? `Plantão ${activeDuty.scheduleName} pausado.`
            : `Plantão ${activeDuty.scheduleName} ativo, ${activeTime}.`
        : nextDuty
          ? `Próximo plantão: ${nextDuty.scheduleName}, ${formatDate(nextDuty.startsAt)} às ${formatTime(nextDuty.startsAt)}.`
          : "Você não tem plantão marcado. Quando o supervisor colocar você na escala, eu aviso aqui.",
      at: activeDuty ? iso(activeDuty.startsAt) : nextDuty ? iso(nextDuty.startsAt) : null,
      unread: false,
      waitingYou: data.duty?.presence?.status === "pending" || activeDuty?.presenceStatus === "pending",
    }),
    assistantThread("agenda", {
      preview: overdueReturn
        ? `Retorno vencido para ${overdueReturn.leadName}.`
        : todayAgenda.length > 0
          ? `Hoje: ${todayAgenda.length} ${todayAgenda.length === 1 ? "retorno" : "retornos"}.`
          : "Você não tem retornos para hoje. Quando combinar um novo contato com um cliente, ele aparece aqui.",
      at: latestIso(todayAgenda.map((item) => item.dueAt)),
      unread: false,
      waitingYou: Boolean(overdueReturn),
    }),
    assistantThread("desempenho", {
      preview: `${data.today.receivedToday} recebidos hoje, ${data.today.slaAtRiskNow} com SLA em risco.`,
      at: data.today.receivedToday > 0 || data.today.acceptedToday > 0 || data.today.inServiceNow > 0 || data.goal ? iso(data.updatedAt) : null,
      unread: false,
      waitingYou: false,
    }),
    assistantThread("insights", {
      preview: "Seus resumos de clientes aparecem por aqui.",
      at: null,
      unread: false,
      waitingYou: false,
    }),
  ];

  if (capabilities.quoteSimulator) {
    threads.push(assistantThread("cotacao", {
      preview: isQuotePausedFor(data.viewer.userId) ? "Em pausa por enquanto." : "O simulador está pronto para uma nova cotação.",
      at: null,
      unread: false,
      waitingYou: false,
    }));
  }

  if (capabilities.journey) {
    const journey = input.journey;
    const open = journey?.missions.filter((m) => m.progress.eligible && !m.progress.completed).length ?? 0;
    threads.push(assistantThread("jornada", {
      preview: journey?.available ? `${journey.level.level.name}, ${journey.week.points} pts na semana. ${open} missões abertas.` : "Sua jornada está sendo preparada.",
      at: latestIso([...(journey?.ledger.map((e) => new Date(e.occurredAt)) ?? []), ...(journey?.celebrations.map((e) => new Date(e.createdAt)) ?? [])]),
      unread: Boolean(journey?.celebrations.length), waitingYou: false,
    }));
  }
  return threads.sort(threadSort);
}

export function buildLeadThreads(input: { queue: BrokerWorkspaceData["queue"]; now: Date }): ThreadSummary[] {
  return input.queue.map((lead) => threadForLead(lead, input.now));
}

function question(id: string, prompt: string, choices: ChatChoice[]): ChatBlock {
  return { type: "question", id, prompt, choices };
}

function assistantMessage(id: string, text: string): ChatBlock {
  return { type: "assistant", id, text };
}

function factSheet(id: string, title: string, rows: Array<{ label: string; value: string }>): ChatBlock {
  return { type: "facts", id, title, rows };
}

const LEADS_OPENERS = [
  "Dei uma olhada nos seus leads.",
  "Separei o que importa agora.",
  "Olha como está a sua carteira.",
  "Bora vender? Aqui vai o resumo.",
  "Seus leads, em uma olhada.",
];

/** The pulse of the broker's leads: numbers, one reading of the funnel and why this is a conversation, not just the list. */
function leadsPulse(data: BrokerWorkspaceData, now: Date): ChatBlock[] {
  const queue = data.queue;
  if (!queue.length) return [];
  const count = (statuses: string[]) => queue.filter((lead) => statuses.includes(lead.status)).length;
  const waiting = queue.filter((lead) => isWaitingPriority(lead.nextAction, now)).length;
  const inService = count(["in_contact", "negotiation", "documentation_pending", "under_analysis"]);
  const quotes = count(["quote_sent"]);
  const negotiation = count(["negotiation"]);
  const stalled = queue.filter((lead) => lead.nextAction?.kind === "follow_up_stalled").length;
  const blocks: ChatBlock[] = [{
    type: "stats", id: "leads-pulse", title: "Seus leads agora", icon: "leads", updatedAt: formatTime(now), goal: null,
    tiles: [
      { label: "Esperando você", value: waiting, tone: "danger" },
      { label: "Em atendimento", value: inService, tone: "info" },
      { label: "Cotação enviada", value: quotes, tone: "warning" },
      { label: "Recebidos hoje", value: data.today.receivedToday, tone: "success" },
    ],
  }];
  const reading = stalled
    ? `${stalled === 1 ? "1 lead está parado" : `${stalled} leads estão parados`} há dias. Uma mensagem leve hoje já reaquece.`
    : quotes
      ? `${quotes === 1 ? "1 cotação enviada" : `${quotes} cotações enviadas`}: hoje é um bom dia para perguntar o que acharam.`
      : negotiation
        ? `${negotiation === 1 ? "1 lead em negociação" : `${negotiation} leads em negociação`}: foque neles para fechar.`
        : data.today.receivedToday === 0
          ? "Nenhum lead novo hoje ainda. Fique disponível no plantão para receber os próximos."
          : "Ritmo bom. Mantenha o primeiro contato rápido em cada lead novo.";
  blocks.push(assistantMessage("leads-reading", reading));
  return blocks;
}

function leadScript(data: BrokerWorkspaceData, now: Date): ChatScript {
  const firstName = data.viewer.name.split(/\s+/)[0] || data.viewer.name;
  // A different opener now and then (by day and hour), so the conversation feels alive.
  const opener = vary(LEADS_OPENERS, now, 0);
  const blocks: ChatBlock[] = [
    { type: "date", id: "leads-date", label: `Hoje, ${formatTime(now)}` },
    assistantMessage("leads-greeting", `${greeting(now)}, ${firstName}! ${opener}`),
    ...leadsPulse(data, now),
  ];
  const action = data.nextAction;

  if (action?.kind === "new_lead") {
    const leadId = action.leadId;
    blocks.push(assistantMessage("leads-new-lead", `Chegou ${action.title}. ${action.description}`));
    blocks.push(question("leads-new-lead-choice", "O que você quer fazer?", [
      { id: "accept", label: "Aceitar e chamar no WhatsApp", action: { kind: "server", name: "lead.accept", payload: { leadId } } },
      { id: "view", label: "Ver a ficha", action: { kind: "href", href: `/leads/${leadId}` } },
      { id: "decline", label: "Recusar", action: { kind: "next", questionId: `decline-${leadId}` } },
    ]));
    blocks.push(question(`decline-${leadId}`, "Por que você quer recusar?", DECLINE_REASONS.map((reason, index) => ({
      id: `decline-${index}`,
      label: reason,
      action: { kind: "server" as const, name: "lead.decline" as const, payload: { leadId, reason } },
    }))));
    pushAlsoWaiting(blocks, data, now, leadId);
    return { blocks, status: { label: "Esperando você", tone: "waiting" } };
  }

  if (action?.kind === "sla_risk" || action?.kind === "sla_overdue") {
    const leadId = action.leadId;
    blocks.push(assistantMessage("leads-sla", `${action.title} espera seu 1º contato há ${minutesSince(action.referenceAt, now)} min.`));
    blocks.push(question("leads-sla-choice", "Como quer seguir?", [
      { id: "open", label: "Abrir conversa", action: { kind: "href", href: `/leads/${leadId}` } },
      { id: "register-contact", label: "Registrar contato", action: { kind: "server", name: "lead.registerContact", payload: { leadId } } },
    ]));
    pushAlsoWaiting(blocks, data, now, leadId);
    return { blocks, status: { label: "Esperando você", tone: "waiting" } };
  }

  // Replies, returns, tasks, quotes, documents and stalled deals: the lead conversation handles each one.
  if (action) {
    const leadId = action.leadId;
    blocks.push(assistantMessage("leads-next", actionPreview(action, now)));
    blocks.push(question("leads-next-choice", "Vamos resolver?", [
      { id: "open", label: `Abrir a conversa de ${action.title.split(" ")[0]}`, action: { kind: "href", href: `/leads/${leadId}` } },
      { id: "queue", label: "Ver todos os meus leads", action: { kind: "href", href: "/minha-fila" } },
    ]));
    pushAlsoWaiting(blocks, data, now, leadId);
    return { blocks, status: isWaitingPriority(action, now) ? { label: "Esperando você", tone: "waiting" } : { label: "Em dia", tone: "idle" } };
  }

  blocks.push(assistantMessage("leads-all-clear", "Tudo em dia por aqui."));
  const inService = data.queue
    .filter((lead) => ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status))
    .slice(0, 5)
    .map((lead) => ({ id: lead.id, lead: lead.name, primary: lead.name, secondary: statusLabel(lead.status), href: `/leads/${lead.id}` }));
  blocks.push({ type: "list", id: "leads-in-service", title: "Em atendimento", items: inService, emptyText: "Você não tem nenhum lead em atendimento agora. Quando aceitar uma oferta, ele aparece nesta lista." });
  if (!inService.length) blocks.push(question("leads-empty-choice", "Quer ver o que chegou?", [
    { id: "new-leads", label: "Ver leads novos", action: { kind: "href", href: "/minha-fila?filter=new" } },
  ]));
  return { blocks, status: { label: "Tudo em dia", tone: "idle" } };
}

/** Other leads waiting for the broker, after the main one. */
function pushAlsoWaiting(blocks: ChatBlock[], data: BrokerWorkspaceData, now: Date, exceptLeadId: string) {
  const items = data.queue
    .filter((lead) => lead.id !== exceptLeadId && isWaitingPriority(lead.nextAction, now))
    .slice(0, 5)
    .map((lead) => ({ id: lead.id, lead: lead.name, primary: lead.name, secondary: lead.nextAction ? actionPreview(lead.nextAction, now) : statusLabel(lead.status), href: `/leads/${lead.id}` }));
  if (items.length) blocks.push({ type: "list", id: "leads-also-waiting", title: "Também esperando você", items });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    in_contact: "Em contato",
    quote_sent: "Cotação enviada",
    negotiation: "Em negociação",
    documentation_pending: "Documentação pendente",
    under_analysis: "Em análise",
  };
  return labels[status] ?? "Em atendimento";
}

function dutyFacts(active: NonNullable<NonNullable<BrokerWorkspaceData["duty"]>["active"]>): ChatBlock {
  return factSheet(`duty-facts-${active.scheduleId}`, "Seu plantão", [
    { label: "Plantão", value: active.scheduleName },
    { label: "Horário", value: `${formatTime(active.startsAt)} às ${formatTime(active.endsAt)}` },
    { label: "Fila", value: active.queueName ?? "Este plantão não está ligado a uma fila." },
    { label: "Unidade", value: active.branchName ?? "Unidade não informada" },
    { label: "Status", value: active.presenceStatus === "pending" ? "Aguardando liberação" : active.paused ? "Pausado" : "Pronto para receber" },
  ]);
}

/** The plantão to confirm as the client sees it (null when nothing to confirm now). */
export function presenceAskOf(data: BrokerWorkspaceData): PresenceAskView | null {
  const presence = data.duty?.presence;
  return presence ? { ...presence, startsAt: presence.startsAt.toISOString(), endsAt: presence.endsAt.toISOString() } : null;
}

function dutyScript(data: BrokerWorkspaceData): ChatScript {
  const active = data.duty?.active;
  const ask = presenceAskOf(data);
  // Confirm first (also 30 min before the start): online with one tap, presencial with a photo of the place.
  if (ask?.status === "awaiting_release") {
    const blocks: ChatBlock[] = active ? [dutyFacts(active)] : [];
    blocks.push(assistantMessage(`duty-presence-wait-${ask.assignmentId}`, "Sua foto chegou para o diretor. Assim que ele validar e liberar, os leads começam a chegar. Até lá você fica pausado."));
    blocks.push({ type: "presence", id: `duty-presence-${ask.assignmentId}`, ask });
    return { blocks, status: { label: "Aguardando liberação", tone: "idle" } };
  }
  if (ask?.status === "pending") {
    const blocks: ChatBlock[] = active ? [dutyFacts(active)] : [];
    blocks.push(assistantMessage(`duty-presence-hint-${ask.assignmentId}`, ask.mode === "presencial"
      ? "Seu plantão é presencial: você precisa estar na unidade, presencialmente, durante todo o plantão. Quando chegar, tire uma foto do local aqui embaixo. O diretor valida a foto e libera você para receber leads."
      : "Confirme sua presença para começar a receber leads."));
    blocks.push({ type: "presence", id: `duty-presence-${ask.assignmentId}`, ask });
    return { blocks, status: { label: "Esperando você", tone: "waiting" } };
  }
  if (active) {
    const blocks: ChatBlock[] = [dutyFacts(active)];
    if (active.presenceStatus === "pending") {
      blocks.push({ type: "system", id: `duty-presence-${active.scheduleId}`, text: "Aguardando o gestor liberar sua presença." });
      blocks.push(assistantMessage(`duty-presence-hint-${active.scheduleId}`, "Assim que o gestor confirmar que você está na unidade, os leads começam a chegar. Não precisa fazer nada."));
      blocks.push(question("duty-presence-choice", "Enquanto isso:", [
        { id: "duty-now", label: "Abrir meu plantão", hint: "Horário, números e leads deste plantão", action: { kind: "href", href: "/plantoes/agora" } },
        { id: "schedule", label: "Ver minha escala", action: { kind: "href", href: "/plantoes" } },
      ]));
      return { blocks, status: { label: "Aguardando liberação", tone: "idle" } };
    }
    if (active.paused) {
      blocks.push(assistantMessage(`duty-paused-${active.scheduleId}`, "Seu plantão está pausado."));
      blocks.push(question("duty-resume-choice", "Quer voltar a receber leads?", [
        { id: "resume", label: "Voltar a receber", action: { kind: "server", name: "duty.resume", payload: {} } },
        { id: "duty-now", label: "Abrir meu plantão", hint: "Horário, números e leads deste plantão", action: { kind: "href", href: "/plantoes/agora" } },
      ]));
      return { blocks, status: { label: "Pausado", tone: "paused" } };
    }
    blocks.push(assistantMessage(`duty-active-${active.scheduleId}`, `Você está no ${active.scheduleName}, pronto para receber.`));
    blocks.push(question("duty-active-choice", "O que você quer fazer?", [
      { id: "duty-now", label: "Abrir meu plantão", hint: "Horário, números e leads deste plantão", action: { kind: "href", href: "/plantoes/agora" } },
      { id: "pause", label: "Pausar agora", hint: "Você volta quando quiser, por aqui", reply: "Pausa, por favor", action: { kind: "server", name: "duty.pause", payload: {} } },
      { id: "schedule", label: "Ver minha escala", action: { kind: "href", href: "/plantoes" } },
    ]));
    return { blocks, status: { label: "Esperando você", tone: "waiting" } };
  }

  const next = data.duty?.next;
  if (!next) return {
    blocks: [
      assistantMessage("duty-empty", "Você não tem plantão marcado. Quando o supervisor colocar você na escala, eu aviso aqui."),
      question("duty-empty-choice", "O que você quer fazer?", [
        { id: "schedule", label: "Ver plantões", action: { kind: "href", href: "/plantoes" } },
      ]),
    ],
    status: { label: "Sem plantão", tone: "idle" },
  };
  const rows = [
    { label: "Plantão", value: next.scheduleName },
    { label: "Data", value: formatDate(next.startsAt) },
    { label: "Horário", value: `${formatTime(next.startsAt)} às ${formatTime(next.endsAt)}` },
    ...(next.queueName ? [{ label: "Fila", value: next.queueName }] : []),
  ];
  return {
    blocks: [
      assistantMessage("duty-next-intro", "Você não está de plantão agora. O próximo é este:"),
      factSheet(`duty-next-${localDateKey(next.startsAt)}-${next.scheduleName}`, "Próximo plantão", rows),
      question("duty-next-choice", "Quer ver mais?", [
        { id: "schedule", label: "Ver minha escala", action: { kind: "href", href: "/plantoes" } },
      ]),
    ],
    status: { label: "Plantão futuro", tone: "idle" },
  };
}

const RESCHEDULE_CHOICES = [
  { value: "today", label: "Hoje às 18h" },
  { value: "tomorrow", label: "Amanhã de manhã" },
  { value: "in_2_days", label: "Em 2 dias" },
  { value: "in_3_days", label: "Em 3 dias" },
] as const;

function agendaScript(data: BrokerWorkspaceData, now: Date): ChatScript {
  if (data.agenda.length === 0) {
    return {
      blocks: [
        // Same id as the summary: after the last return leaves, the message on screen becomes this one.
        assistantMessage("agenda-summary", "Você não tem retornos para hoje. Quando combinar um novo contato com um cliente, ele aparece aqui."),
        question("agenda-empty-choice", "O que você quer fazer?", [
          { id: "returns", label: "Ver meus retornos", action: { kind: "href", href: "/minha-fila?filter=returns" } },
        ]),
      ],
      status: { label: "Agenda livre", tone: "idle" },
    };
  }
  const first = data.agenda[0];
  const items = data.agenda.slice(0, 6).map((item) => ({
    id: item.id,
    lead: item.leadName,
    primary: item.title,
    secondary: item.leadName,
    trailing: item.dueAt ? formatTime(item.dueAt) : undefined,
    href: item.href,
    swipe: { label: "Cancelar", reply: `Cancelar o retorno de ${item.leadName.split(" ")[0] || item.leadName}`, action: { kind: "server" as const, name: "lead.cancelReturn" as const, payload: { taskId: item.id, leadName: item.leadName } } },
  }));
  const overdue = data.agenda.slice(0, 6).filter((item) => item.dueAt && item.dueAt.getTime() <= now.getTime()).length;
  const summary = `Você tem ${items.length} ${items.length === 1 ? "item" : "itens"} na agenda${overdue ? `, ${overdue} já ${overdue === 1 ? "venceu" : "venceram"}` : ""}.`;
  const firstName = first.leadName.split(" ")[0] || first.leadName;
  return {
    blocks: [
      assistantMessage("agenda-summary", summary),
      { type: "list", id: "agenda-items", title: "Seus retornos", subtitle: "Arraste para o lado para cancelar", items },
      question("agenda-choice", "Por onde quer começar?", [
        { id: "start-first", label: `Falar com ${firstName}`, hint: first.title, action: { kind: "href", href: `/leads/${first.leadId}` } },
        { id: "done-first", label: `Já falei com ${firstName}`, action: { kind: "server", name: "lead.completeReturn", payload: { taskId: first.id } } },
        { id: "reschedule-first", label: `Reagendar ${firstName}`, action: { kind: "next", questionId: "agenda-reschedule" } },
        { id: "view-all", label: "Ver todos", action: { kind: "href", href: "/minha-fila?aba=retornos" } },
      ]),
      question("agenda-reschedule", `Para quando passo o retorno de ${firstName}?`, RESCHEDULE_CHOICES.map((option) => ({
        id: `reschedule-${option.value}`,
        label: option.label,
        action: { kind: "server" as const, name: "lead.scheduleReturn" as const, payload: { leadId: first.leadId, when: option.value, taskId: first.id } },
      }))),
    ],
    replayAfterAction: true,
    status: overdue ? { label: "Esperando você", tone: "waiting" } : { label: "Em dia", tone: "idle" },
  };
}

function performanceComment(data: BrokerWorkspaceData) {
  const { receivedToday, acceptedToday, slaAtRiskNow } = data.today;
  if (slaAtRiskNow > 0) return `Atenção: ${slaAtRiskNow} ${slaAtRiskNow === 1 ? "lead está" : "leads estão"} com o primeiro contato atrasando.`;
  if (receivedToday === 0) return "Nenhum lead hoje ainda. Assim que chegar, eu te aviso.";
  if (acceptedToday >= receivedToday) return "Você aceitou tudo o que chegou hoje. Bom ritmo.";
  return `Hoje chegaram ${receivedToday} e você aceitou ${acceptedToday}.`;
}

function performanceScript(data: BrokerWorkspaceData): ChatScript {
  const blocks: ChatBlock[] = [
    assistantMessage("performance-comment", performanceComment(data)),
    factSheet("performance-today", "Seu dia", [
      { label: "Recebidos hoje", value: String(data.today.receivedToday) },
      { label: "Aceitos hoje", value: String(data.today.acceptedToday) },
      { label: "Em atendimento", value: String(data.today.inServiceNow) },
      { label: "SLA em risco", value: String(data.today.slaAtRiskNow) },
    ]),
  ];
  if (data.goal) {
    blocks.push(factSheet("performance-goal", data.goal.name, [
      { label: "Progresso", value: `${data.goal.percentage}%` },
      { label: "Atual", value: data.goal.currentValue },
      { label: "Meta", value: data.goal.targetValue },
    ]));
  }
  blocks.push(question("performance-choice", "O que você quer consultar?", [
    { id: "my-leads", label: "Ver meus leads", action: { kind: "href", href: "/minha-fila" } },
    { id: "my-duties", label: "Ver plantões", action: { kind: "href", href: "/plantoes" } },
  ]));
  return { blocks, status: { label: "Esperando você", tone: "waiting" } };
}

function localHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
}

/**
 * A varied line, stable within the same São Paulo hour (a refresh does not reshuffle
 * the conversation). Built on the server with the page's "now": the screen gets the text.
 */
function vary(options: readonly string[], now: Date, salt: number) {
  return options[(Number(localDateKey(now).replace(/-/g, "")) + localHour(now) + salt) % options.length]!;
}

function durationText(minutes: number) {
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

const OPENERS = {
  plantao: ["Olhei o seu plantão.", "Aqui está o seu plantão.", "Bora ver a escala?", "Seu plantão, rapidinho."],
  agenda: ["Olhei a sua agenda.", "Seus retornos de hoje.", "Bora organizar o dia?", "Aqui está o que você combinou com os clientes."],
  desempenho: ["Seus números de hoje.", "Olha como está o seu dia.", "Dei uma olhada no seu desempenho.", "Bora ver o placar?"],
} as const;

/**
 * One smart line per conversation, read from the broker's own data: time left on
 * the plantão, the next return, the acceptance rate. Short and different each time.
 */
function smartIntro(id: "plantao" | "agenda" | "desempenho", data: BrokerWorkspaceData, now: Date): ChatBlock[] {
  const opener = vary(OPENERS[id], now, id.length);
  let insight: string | null = null;
  if (id === "plantao") {
    const active = data.duty?.active;
    const next = data.duty?.next;
    if (active) {
      const left = Math.round((active.endsAt.getTime() - now.getTime()) / 60_000);
      insight = active.paused ? "Você está pausado: nenhum lead chega até você voltar." : `Faltam ${durationText(left)} para acabar. ${data.today.receivedToday ? `Já chegaram ${data.today.receivedToday} hoje.` : "Fique de olho: o primeiro lead pode chegar a qualquer momento."}`;
    } else if (next) {
      const until = Math.round((next.startsAt.getTime() - now.getTime()) / 60_000);
      insight = until <= 24 * 60 ? `O próximo começa em ${durationText(until)}.` : null;
    }
  } else if (id === "agenda") {
    const upcoming = data.agenda.filter((item) => item.dueAt && item.dueAt.getTime() > now.getTime()).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0];
    const overdue = data.agenda.filter((item) => item.dueAt && item.dueAt.getTime() <= now.getTime()).length;
    insight = overdue
      ? `${overdue === 1 ? "1 retorno passou da hora" : `${overdue} retornos passaram da hora`}: cliente lembrado é cliente quente.`
      : upcoming?.dueAt
        ? `O próximo é com ${upcoming.leadName.split(" ")[0]} daqui a ${durationText(Math.round((upcoming.dueAt.getTime() - now.getTime()) / 60_000))}.`
        : null;
  } else {
    const { receivedToday, acceptedToday } = data.today;
    const rate = receivedToday ? Math.round((acceptedToday / receivedToday) * 100) : null;
    insight = rate === null
      ? null
      : rate >= 90 ? `Você aceitou ${rate}% do que chegou. Excelente!` : `Você aceitou ${rate}% do que chegou hoje. Cada oferta aceita rápido é mais chance de venda.`;
  }
  return [assistantMessage(`${id}-intro`, insight ? `${opener} ${insight}` : opener)];
}

export function buildAssistantScript(
  id: ScriptAssistantId,
  input: { data: BrokerWorkspaceData; now: Date; journey?: BrokerJourneyData | null; dailySummaries?: JourneyCelebration[] },
): ChatScript {
  switch (id) {
    case "leads": return leadScript(input.data, input.now);
    case "plantao": return withIntro(smartIntro("plantao", input.data, input.now), dutyScript(input.data));
    case "agenda": return withIntro(smartIntro("agenda", input.data, input.now), agendaScript(input.data, input.now));
    case "desempenho": return withIntro(smartIntro("desempenho", input.data, input.now), performanceScript(input.data));
    case "jornada": return buildJourneyScript({ journey: input.journey ?? null, dailySummaries: input.dailySummaries ?? [], now: input.now });
  }
}

function withIntro(intro: ChatBlock[], script: ChatScript): ChatScript {
  return { ...script, blocks: [...intro, ...script.blocks] };
}

export function buildJourneyScript(input: { journey: BrokerJourneyData | null; dailySummaries: JourneyCelebration[]; now: Date }): ChatScript {
  const { journey, now } = input;
  const blocks: ChatBlock[] = [];
  for (const summary of [...input.dailySummaries].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (summary.payload.kind !== "daily_summary") continue;
    const { date, received, onTimeContacts, points } = summary.payload;
    blocks.push({ type: "date", id: `journey-day-${summary.id}`, label: dayLabel(new Date(`${date}T12:00:00Z`), now) });
    blocks.push(assistantMessage(`journey-summary-${summary.id}`, `Seu dia: ${received} leads, ${onTimeContacts} contatos no prazo, ${points >= 0 ? "+" : ""}${points} pts.`));
  }
  if (!journey?.available) {
    blocks.push(assistantMessage("journey-unavailable", "Sua jornada está sendo preparada. Volte daqui a pouco."));
    return { blocks, status: { label: "Preparando", tone: "idle" } };
  }
  const open = journey.missions.filter((m) => m.progress.eligible && !m.progress.completed);
  // A varied opener and the one thing that moves the level up now.
  const nextLevel = journey.level.nextLevel;
  const closest = [...open].sort((a, b) => a.progress.remaining - b.progress.remaining)[0];
  const push = closest ? `Mais perto agora: ${closest.title.toLowerCase()}, falta ${closest.progress.remaining} para ganhar ${closest.bonusPoints} pts.` : null;
  const levelLine = nextLevel ? `Faltam ${journey.level.pointsToNext} pts para virar ${nextLevel.name}.` : "Você está no nível mais alto. Que fase!";
  blocks.push(assistantMessage("journey-greeting", `${greeting(now)}! ${vary(["Bora subir de nível?", "Olha a sua jornada.", "Sua jornada, rapidinho.", "Vamos ver seus pontos?"], now, 7)} ${push ?? levelLine}`));
  blocks.push(factSheet("journey-current", "Sua jornada", [
    { label: "Nível", value: journey.level.level.name },
    { label: "Pontos na semana", value: String(journey.week.points) },
    { label: "Missões abertas", value: String(open.length) },
  ]));
  for (const mission of open.slice(0, 3)) {
    blocks.push(assistantMessage(`journey-mission-${mission.id}`, `${mission.title}: ${mission.progress.progress} de ${mission.progress.target}. Bônus de ${mission.bonusPoints} pts.`));
  }
  if (!open.length) blocks.push(assistantMessage("journey-no-missions", "Nenhuma missão aberta agora. Novas missões aparecem todo dia."));
  blocks.push(question("journey-choice", "O que você quer consultar?", [
    { id: "journey", label: "Ver minha jornada", action: { kind: "href", href: "/jornada" } },
    { id: "ledger", label: "Ver extrato", action: { kind: "href", href: "/jornada#extrato" } },
  ]));
  return { blocks, status: { label: "Sua jornada", tone: "waiting" } };
}

/** One notification of the broker (notifications table). */
export type AncoraNotification = { id: string; title: string; message: string; type: string; readAt: Date | null; createdAt: Date; leadId: string | null };

function dayLabel(date: Date, now: Date) {
  const key = localDateKey(date);
  if (key === localDateKey(now)) return "Hoje";
  if (key === localDateKey(new Date(now.getTime() - 86_400_000))) return "Ontem";
  return formatDate(date);
}

/**
 * The Âncora thread: the broker's notifications as messages from the company,
 * oldest first and grouped by day, with a marker before the unread ones.
 */
/** Questions ready to tap in Jack's conversation: the reply value is sent to the AI as if typed. */
export const JACK_ASK_PREFIX = "ask:";
const JACK_ASKS: ChatChoice[] = [
  { id: "jack-first", label: "Quem eu atendo primeiro?", action: { kind: "local", value: `${JACK_ASK_PREFIX}Quem eu atendo primeiro agora?` } },
  { id: "jack-day", label: "Como está meu dia?", action: { kind: "local", value: `${JACK_ASK_PREFIX}Como está o meu dia até agora?` } },
];

export function buildAncoraScript(input: { notifications: AncoraNotification[]; now: Date }): ChatScript {
  const { now } = input;
  const items = [...input.notifications].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (!items.length) {
    return {
      blocks: [
        assistantMessage("ancora-empty", "Oi, eu sou o Jack! Aqui chegam os avisos da Âncora e você pode me perguntar o que quiser sobre o seu dia: quem atender primeiro, seu plantão, seus retornos, sua meta. É só escrever aqui embaixo."),
        question("ancora-choice", "Quer começar por uma destas?", [...JACK_ASKS]),
      ],
      composerPlaceholder: "Pergunte ao Jack",
      status: { label: "Sem avisos novos", tone: "idle" },
    };
  }
  const blocks: ChatBlock[] = [];
  const unread = items.filter((item) => !item.readAt);
  let lastDay = "";
  let markedUnread = false;
  for (const item of items) {
    const day = localDateKey(item.createdAt);
    if (day !== lastDay) {
      blocks.push({ type: "date", id: `ancora-day-${day}`, label: dayLabel(item.createdAt, now) });
      lastDay = day;
    }
    if (!item.readAt && !markedUnread) {
      blocks.push({ type: "system", id: "ancora-unread", text: unread.length === 1 ? "1 aviso novo" : `${unread.length} avisos novos` });
      markedUnread = true;
    }
    blocks.push({ type: "notice", id: `ancora-${item.id}`, noticeType: item.type, leadId: item.leadId, title: item.title, message: item.message || null, at: formatTime(item.createdAt), atIso: item.createdAt.toISOString(), unread: !item.readAt });
  }

  const latestLead = [...unread].reverse().find((item) => item.leadId);
  const choices: ChatChoice[] = [];
  if (latestLead?.leadId) choices.push({ id: "open-lead", label: "Abrir o lead do último aviso", action: { kind: "href", href: `/leads/${latestLead.leadId}` } });
  // A message of the Central that asks for confirmation (relationship.confirmation).
  if (unread.some((item) => item.type === "relationship.confirmation")) {
    choices.push({ id: "relationship-ack", label: "Ciente", reply: "Ciente", action: { kind: "server", name: "relationship.ack", payload: {} } });
  }
  if (unread.length) choices.push({ id: "mark-all", label: "Marcar tudo como lido", reply: "Já vi, pode marcar como lido", action: { kind: "server", name: "notifications.markRead", payload: {} } });
  // Jack answers in this same conversation: two questions ready to tap (the AI answers them).
  blocks.push(assistantMessage("ancora-jack-hint", vary(["Precisa de algo? É só me perguntar aqui embaixo.", "Me pergunte o que quiser sobre o seu dia.", "Quer saber quem atender primeiro? Toque abaixo ou escreva.", "Estou por aqui para o que precisar."], now, 3)));
  choices.push(...JACK_ASKS);
  choices.push({ id: "settings", label: "Configurar avisos", hint: "Notificações no celular e pop-up de lead", action: { kind: "href", href: "/notificacoes" } });
  blocks.push(question("ancora-choice", unread.length ? "O que você quer fazer?" : "Tudo lido. Quer me perguntar algo?", choices));

  return {
    blocks,
    composerPlaceholder: "Pergunte ao Jack",
    status: unread.length ? { label: unread.length === 1 ? "1 aviso novo" : `${unread.length} avisos novos`, tone: "waiting" } : { label: "Tudo lido", tone: "idle" },
  };
}
