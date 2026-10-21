import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { ChatBlock, ChatLeadRow, ChatTone } from "@/components/chat/types";
import type { Mention } from "@/components/chat/composer";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import type { BrokerWorkspacePriority } from "@/features/broker-workspace/priority";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { actionPreview, initials } from "./assistant-scripts";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

/**
 * The "@" of the broker chat: shortcuts that bring live blocks into the
 * conversation and the lead quick card. Everything comes from data the app
 * already loads (the broker workspace); the quick card reads one lead.
 */

const TIME_ZONE = "America/Sao_Paulo";
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });

/** "14:05" today, "ontem 18:10", "12/10". */
function when(date: Date, now: Date) {
  const key = dayKey.format(date);
  if (key === dayKey.format(now)) return timeFormat.format(date);
  if (key === dayKey.format(new Date(now.getTime() - 86_400_000))) return `ontem ${timeFormat.format(date)}`;
  return dayFormat.format(date);
}

/** "há 12 min", "há 3 h", "há 2 dias". */
function since(date: Date, now: Date) {
  const minutes = Math.max(1, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

const CHIP: Record<BrokerWorkspacePriority["kind"], { label: string; tone: ChatTone }> = {
  new_lead: { label: "Novo", tone: "info" },
  awaiting_response: { label: "Respondeu", tone: "success" },
  sla_overdue: { label: "Prazo estourado", tone: "danger" },
  sla_risk: { label: "Prazo em risco", tone: "warning" },
  task_overdue: { label: "Retorno atrasado", tone: "danger" },
  return_due: { label: "Retorno", tone: "warning" },
  proposal_pending: { label: "Cotação", tone: "info" },
  document_pending: { label: "Documentos", tone: "warning" },
  follow_up_stalled: { label: "Parado", tone: "neutral" },
};
const SEVERITY_ORDER = { critical: 0, warning: 1, normal: 2 } as const;

type QueueItem = BrokerWorkspaceData["queue"][number];

function rowForLead(lead: QueueItem, now: Date): ChatLeadRow {
  const action = lead.nextAction;
  return {
    leadId: lead.id,
    name: lead.name,
    initials: initials(lead.name),
    context: action ? actionPreview(action, now) : LEAD_STATUS_LABELS[lead.status] ?? "Em atendimento",
    time: action ? when(action.referenceAt, now) : undefined,
    chip: action ? CHIP[action.kind] : { label: LEAD_STATUS_LABELS[lead.status] ?? "Em atendimento", tone: "neutral" },
  };
}

function byUrgency(a: QueueItem, b: QueueItem) {
  const sa = a.nextAction ? SEVERITY_ORDER[a.nextAction.severity] : 3;
  const sb = b.nextAction ? SEVERITY_ORDER[b.nextAction.severity] : 3;
  if (sa !== sb) return sa - sb;
  return (a.nextAction?.referenceAt.getTime() ?? 0) - (b.nextAction?.referenceAt.getTime() ?? 0);
}

function needsYou(data: BrokerWorkspaceData) {
  return data.queue.filter((lead) => lead.nextAction).sort(byUrgency);
}
function replied(data: BrokerWorkspaceData) {
  return data.queue.filter((lead) => lead.nextAction?.kind === "awaiting_response").sort(byUrgency);
}
function returnsToday(data: BrokerWorkspaceData, now: Date) {
  const today = dayKey.format(now);
  return data.agenda.filter((item) => item.dueAt && dayKey.format(item.dueAt) <= today);
}

/** The @ menu: live counts on the shortcuts and the leads that need the broker first. */
export function buildMentionMenu(data: BrokerWorkspaceData, now = new Date()): Mention[] {
  const waiting = needsYou(data);
  const answers = replied(data);
  const returns = returnsToday(data, now);
  const menu: Mention[] = [
    { handle: "block:precisa", label: "@Precisa de você", note: "Leads que esperam uma ação sua", group: "atalhos", count: waiting.length, tone: waiting.some((l) => l.nextAction?.severity === "critical") ? "danger" : "info" },
    { handle: "block:responderam", label: "@Responderam", note: "Clientes esperando sua mensagem", group: "atalhos", count: answers.length, tone: "success" },
    { handle: "block:retornos", label: "@Retornos de hoje", note: "Quem você combinou de chamar", group: "atalhos", count: returns.length, tone: "warning" },
    { handle: "block:meu-dia", label: "@Meu dia", note: "Seus números de hoje e a meta", group: "atalhos" },
  ];
  const seen = new Set<string>();
  for (const lead of [...waiting, ...data.queue]) {
    if (seen.has(lead.id) || seen.size >= 8) continue;
    seen.add(lead.id);
    menu.push({ handle: `lead:${lead.id}`, label: `@${lead.name}`, note: lead.nextAction ? CHIP[lead.nextAction.kind].label : LEAD_STATUS_LABELS[lead.status] ?? "Em atendimento", group: "leads", initials: initials(lead.name), tone: lead.nextAction ? CHIP[lead.nextAction.kind].tone : "neutral" });
  }
  return menu;
}

/** The live block of a shortcut. */
export function buildShortcutBlock(handle: string, data: BrokerWorkspaceData, now = new Date()): ChatBlock[] {
  const stamp = `${handle}-${now.getTime()}`;
  const updatedAt = timeFormat.format(now);
  if (handle === "block:precisa") {
    return [{ type: "leads", id: stamp, title: "Precisa de você", icon: "leads", rows: needsYou(data).slice(0, 8).map((lead) => rowForLead(lead, now)), emptyText: "Nada esperando você agora. Bom trabalho!", updatedAt }];
  }
  if (handle === "block:responderam") {
    return [{ type: "leads", id: stamp, title: "Responderam", icon: "reply", rows: replied(data).slice(0, 8).map((lead) => rowForLead(lead, now)), emptyText: "Nenhum cliente esperando sua mensagem agora.", updatedAt }];
  }
  if (handle === "block:retornos") {
    const rows = returnsToday(data, now).slice(0, 8).map((item): ChatLeadRow => {
      const overdue = Boolean(item.dueAt && item.dueAt.getTime() < now.getTime());
      return {
        leadId: item.leadId, name: item.leadName, initials: initials(item.leadName), context: item.title,
        time: item.dueAt ? when(item.dueAt, now) : undefined,
        chip: overdue ? { label: "Atrasado", tone: "danger" } : { label: "Hoje", tone: "warning" },
      };
    });
    return [{ type: "leads", id: stamp, title: "Retornos de hoje", icon: "agenda", rows, emptyText: "Nenhum retorno para hoje.", updatedAt }];
  }
  if (handle === "block:meu-dia") {
    const t = data.today;
    return [{
      type: "stats", id: stamp, title: "Meu dia", icon: "day", updatedAt,
      tiles: [
        { label: "Recebidos", value: t.receivedToday },
        { label: "Aceitos", value: t.acceptedToday, tone: "success" },
        { label: "Atendendo", value: t.inServiceNow, tone: "info" },
        { label: "Prazo em risco", value: t.slaAtRiskNow, tone: t.slaAtRiskNow > 0 ? "danger" : "neutral" },
      ],
      goal: data.goal ? { name: data.goal.name, percentage: data.goal.percentage, current: data.goal.currentValue, target: data.goal.targetValue } : null,
    }];
  }
  return [];
}

function readDetail(details: unknown, key: string): string | null {
  if (!details || typeof details !== "object") return null;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : null;
}

function whatsappHref(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return buildWhatsAppUrl(phone);
}

/** The lead's quick card. Brokers only see their own leads. */
export async function buildLeadCard(context: TenantContext, leadId: string, now = new Date()): Promise<ChatBlock[]> {
  const db = getDatabase();
  const [lead] = await db
    .select({
      id: schema.leads.id, nome: schema.leads.nome, status: schema.leads.status, telefone: schema.leads.telefone, tipo: schema.leads.tipo,
      corretorId: schema.leads.corretorId, details: schema.leads.qualificationDetails, assignedAt: schema.leads.assignedAt,
      firstContactAt: schema.leads.firstContactAt, stageEnteredAt: schema.leads.stageEnteredAt, createdAt: schema.leads.createdAt,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
    .limit(1);
  if (!lead || (context.role === "broker" && lead.corretorId !== context.userId)) {
    return [{ type: "assistant", id: `lead-missing-${now.getTime()}`, text: "Não achei esse lead na sua carteira." }];
  }
  const [[lastMessage], [nextTask]] = await Promise.all([
    db.select({ direction: schema.whatsappMessages.direction, sentAt: schema.whatsappMessages.sentAt })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.leadId, lead.id), eq(schema.whatsappMessages.tenantId, context.tenantId)))
      .orderBy(desc(schema.whatsappMessages.sentAt)).limit(1),
    db.select({ title: schema.leadTasks.title, dueAt: schema.leadTasks.dueAt })
      .from(schema.leadTasks)
      .where(and(eq(schema.leadTasks.leadId, lead.id), eq(schema.leadTasks.tenantId, context.tenantId), isNull(schema.leadTasks.completedAt)))
      .orderBy(asc(schema.leadTasks.dueAt)).limit(1),
  ]);

  const isNew = lead.status === "new" || lead.status === "distributed";
  const lives = readDetail(lead.details, "qtdVidas");
  const city = readDetail(lead.details, "cidade") ?? readDetail(lead.details, "city");
  const plan = readDetail(lead.details, "planName") ?? readDetail(lead.details, "operadora");
  const summary = readDetail(lead.details, "resumoAtendimento") ?? readDetail(lead.details, "resumoNecessidade");

  // What needs attention, most urgent first.
  let alert: { tone: ChatTone; text: string } | null = null;
  if (nextTask?.dueAt && nextTask.dueAt.getTime() < now.getTime()) alert = { tone: "danger", text: `Retorno atrasado desde ${when(nextTask.dueAt, now)}` };
  else if (!lead.firstContactAt && lead.assignedAt && !isNew) alert = { tone: "warning", text: `Primeiro contato pendente ${since(lead.assignedAt, now)}` };
  else if (isNew) alert = { tone: "info", text: "Lead novo: aceite para ver o contato" };
  else if (lastMessage?.direction === "incoming") alert = { tone: "success", text: `Respondeu ${since(lastMessage.sentAt, now)} e espera você` };
  else if (lastMessage && now.getTime() - lastMessage.sentAt.getTime() > 2 * 86_400_000) alert = { tone: "warning", text: `Sem resposta ${since(lastMessage.sentAt, now)}` };
  else if (lead.status === "quote_sent" && now.getTime() - lead.stageEnteredAt.getTime() > 3 * 86_400_000) alert = { tone: "warning", text: `Cotação parada ${since(lead.stageEnteredAt, now)}` };

  const rows: Array<{ label: string; value: string }> = [];
  rows.push({ label: "Tipo", value: `${lead.tipo === "PJ" || lead.tipo === "PME" ? "Empresa" : "Pessoa física"}${lives ? `, ${lives} ${lives === "1" ? "vida" : "vidas"}` : ""}` });
  if (plan) rows.push({ label: "Plano", value: plan });
  if (city) rows.push({ label: "Cidade", value: city });
  rows.push({ label: "Chegou", value: when(lead.assignedAt ?? lead.createdAt, now) });
  if (lastMessage) rows.push({ label: "Última mensagem", value: `${lastMessage.direction === "incoming" ? "do cliente" : "sua"}, ${when(lastMessage.sentAt, now)}` });
  if (nextTask) rows.push({ label: "Próximo retorno", value: `${nextTask.dueAt ? when(nextTask.dueAt, now) : "sem horário"}` });
  if (summary) rows.push({ label: "Resumo", value: summary.length > 140 ? `${summary.slice(0, 137)}...` : summary });

  return [{
    type: "leadcard", id: `leadcard-${lead.id}-${now.getTime()}`, leadId: lead.id, name: lead.nome, initials: initials(lead.nome),
    stage: LEAD_STATUS_LABELS[lead.status] ?? lead.status, alert, rows,
    whatsappHref: isNew ? null : whatsappHref(lead.telefone),
    href: `/leads/${lead.id}`, fichaHref: `/leads/${lead.id}?ficha=1`, updatedAt: timeFormat.format(now),
  }];
}
