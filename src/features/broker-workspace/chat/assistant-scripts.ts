import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import type {
  AssistantId,
  ChatBlock,
  ChatChoice,
  ChatScript,
  MascotShape,
  ThreadSummary,
} from "@/components/chat/types";
import type { BrokerWorkspacePriority } from "@/features/broker-workspace/priority";
import { DECLINE_REASONS } from "@/features/broker-workspace/components/light-lead-detail/types";

const TIME_ZONE = "America/Sao_Paulo";

type AssistantDefinition = {
  name: string;
  shape: MascotShape;
  hue: number | null;
  verified?: boolean;
  href: string;
};

export const ASSISTANTS: Record<AssistantId, AssistantDefinition> = {
  ancora: { name: "Âncora", shape: "logo", hue: null, verified: true, href: "/dashboard/c/ancora" },
  leads: { name: "Leads", shape: "mochi", hue: 212, href: "/dashboard/c/leads" },
  plantao: { name: "Plantão", shape: "onigiri", hue: 28, href: "/dashboard/c/plantao" },
  agenda: { name: "Agenda", shape: "cubo", hue: 150, href: "/dashboard/c/agenda" },
  cotacao: { name: "Cotação", shape: "favo", hue: 268, href: "/cotacao" },
  desempenho: { name: "Desempenho", shape: "nuvem", hue: 330, href: "/dashboard/c/desempenho" },
  insights: { name: "Insights", shape: "salte", hue: 200, href: "/conversas/broker" },
};

type LeadQueueItem = BrokerWorkspaceData["queue"][number];
type ScriptAssistantId = Exclude<AssistantId, "ancora" | "cotacao" | "insights">;

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

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("");
}

function minutesSince(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
}

function actionPreview(action: BrokerWorkspacePriority, now: Date) {
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
    at: iso(action?.referenceAt),
    unread,
    waitingYou,
    href: `/leads/${lead.id}`,
    shape: "mochi",
    hue: null,
    initials: initials(lead.name),
    temperature: null,
  };
}

function assistantThread(id: AssistantId, values: Pick<ThreadSummary, "preview" | "at" | "unread" | "waitingYou">): ThreadSummary {
  const assistant = ASSISTANTS[id];
  return {
    id: `assistant:${id}`,
    kind: "assistant",
    assistant: id,
    name: assistant.name,
    verified: assistant.verified,
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
  if (left.waitingYou !== right.waitingYou) return left.waitingYou ? -1 : 1;
  if (left.unread !== right.unread) return left.unread ? -1 : 1;
  const leftAt = left.at ? Date.parse(left.at) : Number.NEGATIVE_INFINITY;
  const rightAt = right.at ? Date.parse(right.at) : Number.NEGATIVE_INFINITY;
  return rightAt - leftAt || left.id.localeCompare(right.id);
}

export function buildAssistantThreads(input: {
  data: BrokerWorkspaceData;
  capabilities: { quoteSimulator: boolean; dutyCalendar: boolean };
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
        : "Sem avisos novos.",
      at: data.today.unreadNotifications > 0 ? iso(data.updatedAt) : null,
      unread: data.today.unreadNotifications > 0,
      waitingYou: false,
    }),
    assistantThread("leads", {
      preview: leadPreview?.preview ?? "Tudo em dia por aqui.",
      at: latestIso(leads.map((lead) => lead.at ? new Date(lead.at) : null)),
      unread: leads.some((lead) => lead.unread),
      waitingYou: leads.some((lead) => lead.waitingYou),
    }),
    assistantThread("plantao", {
      preview: activeDuty
        ? activeDuty.presenceStatus === "pending"
          ? `Aguardando liberação do plantão ${activeDuty.scheduleName}.`
          : activeDuty.paused
            ? `Plantão ${activeDuty.scheduleName} pausado.`
            : `Plantão ${activeDuty.scheduleName} ativo, ${activeTime}.`
        : nextDuty
          ? `Próximo plantão: ${nextDuty.scheduleName}, ${formatDate(nextDuty.startsAt)} às ${formatTime(nextDuty.startsAt)}.`
          : "Nenhum plantão agendado.",
      at: activeDuty ? iso(activeDuty.startsAt) : nextDuty ? iso(nextDuty.startsAt) : null,
      unread: false,
      waitingYou: activeDuty?.presenceStatus === "pending",
    }),
    assistantThread("agenda", {
      preview: overdueReturn
        ? `Retorno vencido para ${overdueReturn.leadName}.`
        : todayAgenda.length > 0
          ? `Hoje: ${todayAgenda.length} ${todayAgenda.length === 1 ? "retorno" : "retornos"}.`
          : "Sem retornos hoje.",
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
      preview: "O simulador está pronto para uma nova cotação.",
      at: null,
      unread: false,
      waitingYou: false,
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

function leadScript(data: BrokerWorkspaceData, now: Date): ChatScript {
  const blocks: ChatBlock[] = [
    { type: "date", id: "leads-date", label: `Hoje, ${formatTime(now)}` },
    assistantMessage("leads-greeting", `${greeting(now)}, ${data.viewer.name}.`),
  ];
  const action = data.nextAction;

  if (action?.kind === "new_lead") {
    const leadId = action.leadId;
    blocks.push(assistantMessage("leads-new-lead", `Chegou ${action.title}. ${action.description}`));
    blocks.push(question("leads-new-lead-choice", "O que você quer fazer?", [
      { id: "accept", label: "Aceitar", action: { kind: "server", name: "lead.accept", payload: { leadId } } },
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
  blocks.push({ type: "list", id: "leads-in-service", title: "Em atendimento", items: inService, emptyText: "Nenhum lead em atendimento." });
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
    { label: "Fila", value: active.queueName ?? "Sem fila informada" },
    { label: "Unidade", value: active.branchName ?? "Unidade não informada" },
    { label: "Status", value: active.presenceStatus === "pending" ? "Aguardando liberação" : active.paused ? "Pausado" : "Pronto para receber" },
  ]);
}

function dutyScript(data: BrokerWorkspaceData): ChatScript {
  const active = data.duty?.active;
  if (active) {
    const blocks: ChatBlock[] = [dutyFacts(active)];
    if (active.presenceStatus === "pending") {
      blocks.push({ type: "system", id: `duty-presence-${active.scheduleId}`, text: "Aguardando o gestor liberar sua presença." });
      blocks.push(assistantMessage(`duty-presence-hint-${active.scheduleId}`, "Assim que o gestor confirmar que você está na unidade, os leads começam a chegar. Não precisa fazer nada."));
      blocks.push(question("duty-presence-choice", "Enquanto isso:", [
        { id: "schedule", label: "Ver minha escala", action: { kind: "href", href: "/plantoes" } },
      ]));
      return { blocks, status: { label: "Aguardando liberação", tone: "idle" } };
    }
    if (active.paused) {
      blocks.push(assistantMessage(`duty-paused-${active.scheduleId}`, "Seu plantão está pausado."));
      blocks.push(question("duty-resume-choice", "Quer voltar a receber leads?", [
        { id: "resume", label: "Voltar a receber", action: { kind: "server", name: "duty.resume", payload: {} } },
      ]));
      return { blocks, status: { label: "Pausado", tone: "paused" } };
    }
    blocks.push(assistantMessage(`duty-active-${active.scheduleId}`, `Você está no ${active.scheduleName}, pronto para receber.`));
    blocks.push(question("duty-active-choice", "O que você quer fazer?", [
      { id: "pause", label: "Pausar agora", hint: "Você volta quando quiser, por aqui", reply: "Pausa, por favor", action: { kind: "server", name: "duty.pause", payload: {} } },
      { id: "schedule", label: "Ver minha escala", action: { kind: "href", href: "/plantoes" } },
    ]));
    return { blocks, status: { label: "Esperando você", tone: "waiting" } };
  }

  const next = data.duty?.next;
  if (!next) return { blocks: [assistantMessage("duty-empty", "Nenhum plantão agendado.")], status: { label: "Sem plantão", tone: "idle" } };
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
    return { blocks: [assistantMessage("agenda-empty", "Sem retornos hoje.")], status: { label: "Agenda livre", tone: "idle" } };
  }
  const first = data.agenda[0];
  const items = data.agenda.map((item) => ({
    id: item.id,
    lead: item.leadName,
    primary: item.title,
    secondary: item.leadName,
    trailing: item.dueAt ? formatTime(item.dueAt) : undefined,
    href: item.href,
  }));
  const overdue = data.agenda.filter((item) => item.dueAt && item.dueAt.getTime() <= now.getTime()).length;
  const summary = `Você tem ${items.length} ${items.length === 1 ? "item" : "itens"} na agenda${overdue ? `, ${overdue} já ${overdue === 1 ? "venceu" : "venceram"}` : ""}.`;
  const firstName = first.leadName.split(" ")[0] || first.leadName;
  return {
    blocks: [
      assistantMessage("agenda-summary", summary),
      { type: "list", id: "agenda-items", title: "Seus retornos", items },
      question("agenda-choice", "Por onde quer começar?", [
        { id: "start-first", label: `Falar com ${firstName}`, hint: first.title, action: { kind: "href", href: `/leads/${first.leadId}` } },
        { id: "reschedule-first", label: `Reagendar ${firstName}`, action: { kind: "next", questionId: "agenda-reschedule" } },
        { id: "view-all", label: "Ver todos", action: { kind: "href", href: "/minha-fila?aba=retornos" } },
      ]),
      question("agenda-reschedule", `Para quando passo o retorno de ${firstName}?`, RESCHEDULE_CHOICES.map((option) => ({
        id: `reschedule-${option.value}`,
        label: option.label,
        action: { kind: "server" as const, name: "lead.scheduleReturn" as const, payload: { leadId: first.leadId, when: option.value } },
      }))),
    ],
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

export function buildAssistantScript(
  id: ScriptAssistantId,
  input: { data: BrokerWorkspaceData; now: Date },
): ChatScript {
  switch (id) {
    case "leads": return leadScript(input.data, input.now);
    case "plantao": return dutyScript(input.data);
    case "agenda": return agendaScript(input.data, input.now);
    case "desempenho": return performanceScript(input.data);
  }
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
export function buildAncoraScript(input: { notifications: AncoraNotification[]; now: Date }): ChatScript {
  const { now } = input;
  const items = [...input.notifications].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (!items.length) {
    return {
      blocks: [assistantMessage("ancora-empty", "Por aqui chegam os avisos da Âncora: escala publicada, recados da gestão e alertas dos seus leads. Nada novo por enquanto.")],
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
    const text = item.message && item.message !== item.title ? `${item.title}. ${item.message}` : item.title;
    blocks.push({ type: "assistant", id: `ancora-${item.id}`, text, at: formatTime(item.createdAt) });
  }

  const latestLead = [...unread].reverse().find((item) => item.leadId);
  const choices: ChatChoice[] = [];
  if (latestLead?.leadId) choices.push({ id: "open-lead", label: "Abrir o lead do último aviso", action: { kind: "href", href: `/leads/${latestLead.leadId}` } });
  // A message of the Central that asks for confirmation (relationship.confirmation).
  if (unread.some((item) => item.type === "relationship.confirmation")) {
    choices.push({ id: "relationship-ack", label: "Ciente", reply: "Ciente", action: { kind: "server", name: "relationship.ack", payload: {} } });
  }
  if (unread.length) choices.push({ id: "mark-all", label: "Marcar tudo como lido", reply: "Já vi, pode marcar como lido", action: { kind: "server", name: "notifications.markRead", payload: {} } });
  choices.push({ id: "settings", label: "Configurar avisos", hint: "Notificações no celular e pop-up de lead", action: { kind: "href", href: "/notificacoes" } });
  blocks.push(question("ancora-choice", unread.length ? "O que você quer fazer?" : "Tudo lido. Quer ajustar seus avisos?", choices));

  return {
    blocks,
    status: unread.length ? { label: unread.length === 1 ? "1 aviso novo" : `${unread.length} avisos novos`, tone: "waiting" } : { label: "Tudo lido", tone: "idle" },
  };
}
