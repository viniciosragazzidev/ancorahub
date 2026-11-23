import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { runGateway } from "@/features/ai-gateway/gateway";
import { maskPersonalData } from "@/features/ai-gateway/privacy";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { nextStepText, readLeadIntelligence } from "@/features/broker-workspace/chat/intelligence";
import { getBrokerDutyCalendarData } from "@/features/broker-workspace/duty-calendar-queries";
import { canRevealLightContact } from "@/features/broker-workspace/lead-contact-privacy";
import { presenceAskOf } from "@/features/broker-workspace/chat/assistant-scripts";
import { getBrokerClientWallet } from "@/features/customers/broker-client-wallet";
import { getBrokerHighlights } from "@/features/engagement/broker-stats";
import { RANK_LABEL } from "@/features/engagement/ranking";
import { getBrokerFinanceDetail } from "@/features/erp/broker-finance";
import { getSales } from "@/features/sales/queries";
import type { TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { agentStepSchema, runSasaAgentLoop, type AgentResult } from "./ecosystem-agent";
import type { ChatBlock } from "@/components/chat/types";

import { answerFromFacts, factsToLines, leadLookupBlocks, type SasaFacts } from "./ecosystem-answers";
import { areasOf, isLeadLookup, wantsAnalysis, type SasaArea } from "./ecosystem-areas";
import { nameHintOf } from "./intent-rules";
import { resolveLead } from "./resolve-entities";

/**
 * Ferramentas de leitura do Sasá sobre o ecossistema do corretor (19/11). Uma por área, cada uma com a consulta
 * que a própria tela usa e o tenant, corretor e papel da sessão (nunca vindos da IA, nunca SQL livre).
 * Sem acesso a uma área, o fato diz isso (ex.: `finance.access = false`) e a resposta também.
 */
type Workspace = Awaited<ReturnType<typeof getCachedBrokerWorkspaceData>>;
type Loader = (input: { context: TenantContext; question: string; data: Workspace; now: Date; leadHint: string | null }) => Promise<Partial<SasaFacts>>;

const WAITING_KINDS: Record<string, "respondeu" | "lead novo" | "1º contato"> = { awaiting_response: "respondeu", new_lead: "lead novo", sla_risk: "1º contato", sla_overdue: "1º contato" };
const minutesSince = (date: Date | null | undefined, now: Date) => (date ? Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000)) : null);
const monthLabel = (now: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long" }).format(now);
const periodLabel = (period: string) => period.split("-").reverse().join("/");

/** Primeiro dia do mês em São Paulo (fuso fixo -03:00). */
function spMonthStart(now: Date) {
  const shifted = new Date(now.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) + 3 * 3_600_000);
}

const LOADERS: Record<SasaArea, Loader> = {
  async leads({ data, now }) {
    const byStatus: Record<string, number> = {};
    for (const lead of data.queue) byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
    return {
      leads: {
        active: data.queue.length, byStatus, newCount: (byStatus.new ?? 0) + (byStatus.distributed ?? 0), receivedToday: data.today.receivedToday, acceptedToday: data.today.acceptedToday,
        waiting: data.queue.filter((lead) => lead.nextAction && WAITING_KINDS[lead.nextAction.kind]).map((lead) => ({
          name: lead.name, reason: WAITING_KINDS[lead.nextAction!.kind]!, minutes: minutesSince(lead.nextAction!.referenceAt ?? lead.arrivedAt, now),
          urgent: lead.nextAction!.kind === "sla_overdue" || lead.nextAction!.kind === "sla_risk",
        })),
      },
    };
  },

  async lead({ context, question, data, leadHint }) {
    const match = resolveLead(question, data.queue.map((lead) => ({ id: lead.id, name: lead.name, status: lead.status })), leadHint);
    if (match.kind === "none") return { lead: { kind: "none", asked: leadHint ?? nameHintOf(question) } };
    if (match.kind === "many") return { lead: { kind: "many", names: match.leads.map((lead) => lead.name), leads: match.leads.map((lead) => ({ id: lead.id, name: lead.name })) } };
    const db = getDatabase();
    // Só um lead da fila do próprio corretor, conferido de novo no banco (tenant e corretor da sessão).
    const [lead] = await db.select({ status: schema.leads.status, tipo: schema.leads.tipo, createdAt: schema.leads.createdAt, qualificationDetails: schema.leads.qualificationDetails, corretorId: schema.leads.corretorId })
      .from(schema.leads).where(and(eq(schema.leads.id, match.lead.id), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), isNull(schema.leads.deletedAt))).limit(1);
    if (!lead) return { lead: { kind: "none", asked: match.lead.name } };
    const reveal = canRevealLightContact({ status: lead.status, isCurrentBroker: lead.corretorId === context.userId });
    const [notes, messages] = await Promise.all([
      db.select({ at: schema.leadInteractions.createdAt, text: schema.leadInteractions.conteudo }).from(schema.leadInteractions)
        .where(and(eq(schema.leadInteractions.leadId, match.lead.id), eq(schema.leadInteractions.tipo, "note"))).orderBy(desc(schema.leadInteractions.createdAt)).limit(3),
      reveal
        ? db.select({ body: schema.whatsappMessages.body, direction: schema.whatsappMessages.direction, senderRole: schema.whatsappMessages.senderRole, at: schema.whatsappMessages.sentAt })
          .from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, match.lead.id))).orderBy(desc(schema.whatsappMessages.sentAt)).limit(1)
        : Promise.resolve([]),
    ]);
    const ai = readLeadIntelligence(lead.qualificationDetails);
    const last = messages[0];
    const outbound = last && (last.direction === "outgoing" || last.direction === "outbound");
    return {
      lead: {
        kind: "one", id: match.lead.id, name: match.lead.name, status: lead.status, tipo: lead.tipo ?? null, arrivedAt: lead.createdAt,
        since: data.queue.find((item) => item.id === match.lead.id)?.arrivedAt ?? lead.createdAt,
        summary: ai.summary ? maskPersonalData(ai.summary) : null, nextStep: ai.nextBestAction ? maskPersonalData(nextStepText(ai.nextBestAction) ?? "") || null : null, objections: ai.objections ?? [],
        lastMessage: last?.body && last.at ? { from: outbound ? (last.senderRole === "assistant" ? "qualificação" : "corretor") : "cliente", text: maskPersonalData(last.body).slice(0, 200), at: last.at } : null,
        notes: notes.map((note) => ({ at: note.at, text: maskPersonalData(note.text).slice(0, 200) })),
      },
    };
  },

  async wallet({ context, now }) {
    // Mesma consulta da tela Minha carteira: a visão "Renovações" traz a contagem e a lista.
    const renewals = await getBrokerClientWallet(context, { view: "renewals", page: 1 }, now);
    const clients = await getDatabase().select({ name: schema.clients.nome, convertedAt: schema.clients.convertedAt }).from(schema.clients)
      .where(and(eq(schema.clients.tenantId, context.tenantId), eq(schema.clients.corretorId, context.userId))).limit(1000);
    const in30 = now.getTime() + 30 * 86_400_000;
    const anniversaries = clients.flatMap((client) => {
      const on = new Date(client.convertedAt);
      const years = new Date(now).getUTCFullYear() - on.getUTCFullYear();
      for (const year of [years, years + 1]) {
        const date = new Date(Date.UTC(on.getUTCFullYear() + year, on.getUTCMonth(), on.getUTCDate(), 12));
        if (year >= 1 && date.getTime() >= now.getTime() - 86_400_000 && date.getTime() <= in30) return [{ name: client.name, on: date, years: year }];
      }
      return [];
    }).sort((a, b) => a.on.getTime() - b.on.getTime()).slice(0, 8);
    return {
      wallet: {
        total: renewals.walletCount, attention: renewals.counts.attention, renewalCount: renewals.counts.renewals, hasRenewalData: renewals.hasRenewalData,
        renewals: renewals.rows.slice(0, 8).map((row) => ({ name: row.name, from: row.renewalWindowStartDate ? row.renewalWindowStartDate.split("-").reverse().slice(0, 2).join("/") : "sem data" })),
        anniversaries,
      },
    };
  },

  async duty({ data, now }) {
    const active = data.duty?.activeAll?.length ? data.duty.activeAll : data.duty?.active ? [data.duty.active] : [];
    // A escala sai da mesma consulta da tela de plantões; desligada para a empresa, fica null ("não liberada").
    const calendar = await getBrokerDutyCalendarData(now).catch(() => null);
    const in7 = now.getTime() + 7 * 86_400_000;
    const ask = presenceAskOf(data);
    return {
      duty: {
        active: active.map((duty) => ({ name: duty.scheduleName, startsAt: duty.startsAt, endsAt: duty.endsAt, paused: duty.paused, presence: duty.presenceStatus })),
        next: data.duty?.next ? { name: data.duty.next.scheduleName, startsAt: data.duty.next.startsAt, endsAt: data.duty.next.endsAt } : null,
        week: calendar ? calendar.occurrences.map((item) => ({ name: item.scheduleName, startsAt: new Date(item.startsAt), endsAt: new Date(item.endsAt) })).filter((item) => item.endsAt.getTime() >= now.getTime() && item.startsAt.getTime() <= in7) : null,
        presenceAsk: ask ? { name: ask.scheduleName, status: ask.status } : null,
      },
    };
  },

  async agenda({ data }) {
    return { agenda: { items: data.agenda.map((item) => ({ lead: item.leadName, title: maskPersonalData(item.title), dueAt: item.dueAt })) } };
  },

  async performance({ context, data, now }) {
    const highlights = await getBrokerHighlights(context.tenantId, context.userId, now).catch(() => null);
    return {
      performance: {
        today: { received: data.today.receivedToday, accepted: data.today.acceptedToday, returnsDue: data.today.returnsDue, awaiting: data.today.awaitingResponse },
        goal: data.goal ? { name: data.goal.name, current: data.goal.currentValue, target: data.goal.targetValue, percentage: data.goal.percentage } : null,
        week: highlights?.stats ? { offered: highlights.stats.offered, accepted: highlights.stats.accepted, started: highlights.stats.started ?? 0, medianAcceptSeconds: highlights.stats.medianAcceptSeconds ?? null, medianStartSeconds: highlights.stats.medianStartSeconds ?? null } : null,
        ranks: (highlights?.ranks ?? []).map((rank) => ({ position: rank.position, total: rank.total, label: RANK_LABEL[rank.key] })),
      },
    };
  },

  async finance({ context, now }) {
    // As mesmas somas do Meu financeiro: a receber, recebido no mês (com o pago fora do ERP) e o previsto pelo cronograma.
    const detail = await getBrokerFinanceDetail(context, {}, now).catch(() => null);
    if (!detail) return { finance: { access: false } };
    return {
      finance: {
        access: true, periodLabel: detail.summary.periodLabel, receivableCents: detail.summary.receivableCents, receivedThisMonthCents: detail.summary.receivedThisMonthCents, openAdvancesCents: detail.summary.openAdvancesCents,
        forecast: (detail.insights?.forecast ?? []).map((point) => ({ label: point.label, cents: point.cents })),
        nextInstallment: detail.insights?.nextInstallment ? { label: periodLabel(detail.insights.nextInstallment.referenceMonth), cents: detail.insights.nextInstallment.amountCents, client: detail.insights.nextInstallment.clientName } : null,
      },
    };
  },

  async sales({ context, now }) {
    // Mesma consulta da tela de vendas (escopo por papel), só as do próprio corretor e ativas.
    const own = (await getSales()).filter((sale) => sale.brokerId === context.userId && sale.status === "active");
    const start = spMonthStart(now);
    const month = own.filter((sale) => sale.saleDate.getTime() >= start.getTime());
    const sum = (rows: typeof own) => Math.round(rows.reduce((total, sale) => total + Number(sale.saleValue || 0), 0) * 100) / 100;
    return {
      sales: {
        monthLabel: monthLabel(now), monthCount: month.length, monthValue: sum(month), totalCount: own.length, totalValue: sum(own),
        last: [...own].sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime()).slice(0, 5).map((sale) => ({ on: sale.saleDate, client: sale.clientName ?? sale.leadName, plan: [sale.carrierName, sale.planName].filter(Boolean).join(" ") || null, value: Number(sale.saleValue || 0) })),
      },
    };
  },

  async quotes({ context }) {
    const db = getDatabase();
    const [quotes, proposals] = await Promise.all([
      db.select({ lead: schema.quotes.leadName, status: schema.quotes.status, total: schema.quotes.totalMonthly, at: schema.quotes.createdAt })
        .from(schema.quotes).where(and(eq(schema.quotes.tenantId, context.tenantId), eq(schema.quotes.createdBy, context.userId))).orderBy(desc(schema.quotes.createdAt)).limit(8),
      db.select({ lead: schema.proposals.leadName, title: schema.proposals.title, status: schema.proposals.status, total: schema.proposals.totalMonthly, at: schema.proposals.createdAt })
        .from(schema.proposals).where(and(eq(schema.proposals.tenantId, context.tenantId), eq(schema.proposals.createdBy, context.userId))).orderBy(desc(schema.proposals.createdAt)).limit(8),
    ]);
    return {
      quotes: {
        quotes: quotes.map((row) => ({ lead: row.lead ?? "cliente", status: row.status, total: row.total ? Number(row.total) : null, at: row.at })),
        proposals: proposals.map((row) => ({ lead: row.lead, title: row.title, status: row.status, total: Number(row.total), at: row.at })),
      },
    };
  },

  async notifications({ context }) {
    const rows = await getDatabase().select({ title: schema.notifications.title, readAt: schema.notifications.readAt, at: schema.notifications.createdAt })
      .from(schema.notifications).where(and(eq(schema.notifications.tenantId, context.tenantId), eq(schema.notifications.recipientUserId, context.userId)))
      .orderBy(desc(schema.notifications.createdAt)).limit(20);
    return { notifications: { unread: rows.filter((row) => !row.readAt).length, items: rows.map((row) => ({ title: maskPersonalData(row.title), at: row.at, unread: !row.readAt })) } };
  },

  async account({ context, data }) {
    // O mesmo dado do ícone de WhatsApp do Início (/api/chat/whatsapp): status e quando conectou, nunca a sessão.
    const [connection] = await getDatabase().select({ status: schema.whatsappConnections.status, connectedAt: schema.whatsappConnections.connectedAt })
      .from(schema.whatsappConnections).where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId))).limit(1);
    return { account: { whatsapp: connection?.status ?? "disconnected", connectedAt: connection?.connectedAt ?? null, availability: data.viewer.availabilityStatus } };
  },
};

async function loadFacts(context: TenantContext, areas: SasaArea[], question: string, data: Workspace, now: Date, leadHint: string | null): Promise<SasaFacts> {
  const parts = await Promise.all(areas.map((area) => LOADERS[area]({ context, question, data, now, leadHint }).catch((error) => {
    console.error(`[sasa] read ${area} failed`, error);
    return {};
  })));
  return Object.assign({}, ...parts) as SasaFacts;
}

/**
 * Áreas da pergunta pelas palavras. Um lead nomeado (ou uma consulta "tem algum lead chamado X?") vira a área "lead"
 * na frente e tira o resumo genérico da fila: quem pergunta por alguém quer esse alguém.
 */
export function sasaQuestionAreas(question: string, data: Pick<Workspace, "queue">): SasaArea[] {
  const areas = areasOf(question);
  const named = resolveLead(question, data.queue.map((lead) => ({ id: lead.id, name: lead.name, status: lead.status })));
  if (named.kind !== "none" || isLeadLookup(question)) return (["lead"] as SasaArea[]).concat(areas.filter((area) => area !== "lead" && area !== "leads")).slice(0, 3);
  return areas.slice(0, 3);
}


export type SasaAnswer = { text: string; blocks?: ChatBlock[]; areas: SasaArea[]; via: "direct" | "agent"; truncated?: boolean; reason?: AgentResult["reason"] };

/**
 * Responde uma pergunta do corretor. Primeiro direto, pelos fatos das áreas (sem IA). Sem resposta direta e com a
 * IA dinâmica permitida (chave da empresa + consentimento, conferidos por quem chama), a camada limitada combina
 * leituras. null = deixa para a resposta de sempre.
 */
export async function answerSasaQuestion(context: TenantContext, question: string, options: { dynamic: boolean; now?: Date }): Promise<SasaAnswer | null> {
  const now = options.now ?? new Date();
  const data = await getCachedBrokerWorkspaceData();
  const areas = sasaQuestionAreas(question, data);
  if (areas[0] === "lead" && !wantsAnalysis(question)) {
    // Consulta de um lead: só ele, com "Abrir"; nada de resumo da carteira junto.
    const facts = await loadFacts(context, ["lead"], question, data, now, null);
    const blocks = leadLookupBlocks(facts, now, String(now.getTime()));
    if (blocks) return { text: blocks.map((block) => (block.type === "assistant" ? block.text : "")).join(" ").trim(), blocks, areas: ["lead"], via: "direct" };
  }
  if (areas.length && !wantsAnalysis(question)) {
    const facts = await loadFacts(context, areas.slice(0, 2), question, data, now, null);
    const answers = areas.slice(0, 2).map((area) => answerFromFacts(question, area, facts, now)).filter((text): text is string => Boolean(text));
    if (answers.length) return { text: answers.join(" "), areas: areas.slice(0, 2), via: "direct" };
  }
  if (!options.dynamic) return null;

  const cache = new Map<string, string>();
  const result = await runSasaAgentLoop({
    question,
    hint: areas,
    read: async (area, lead) => {
      const key = `${area}:${lead ?? ""}`;
      if (!cache.has(key)) {
        const facts = await loadFacts(context, [area], lead ? `${question} ${lead}` : question, data, now, lead);
        cache.set(key, factsToLines(area, facts, now));
      }
      return cache.get(key)!;
    },
    ask: async (messages, remainingMs) => {
      const step = await runGateway({
        profile: "chat-fast", purpose: "sasa_agent", tenantId: context.tenantId, userId: context.userId, sensitive: true, maskPersonalData: true,
        maxTokens: 350, temperature: 0.2, totalTimeoutMs: Math.max(1_000, remainingMs), schema: agentStepSchema, messages,
      });
      return step.ok ? step.value : null;
    },
  });
  return { text: result.text, areas: result.reads, via: "agent", truncated: result.truncated, reason: result.reason };
}

/** Contexto em texto para a resposta de sempre (askAssistantAction), quando a pergunta chega por lá. */
export async function sasaEcosystemContext(context: TenantContext, question: string, now = new Date()) {
  const data = await getCachedBrokerWorkspaceData();
  const areas = sasaQuestionAreas(question, data);
  const chosen: SasaArea[] = areas.length ? areas : ["leads", "agenda", "performance"];
  const facts = await loadFacts(context, chosen, question, data, now, null);
  const text = [`Corretor: ${data.viewer.name.split(/\s+/)[0]}. Unidade: ${data.viewer.branchName}.`, ...chosen.map((area) => `[${area}] ${factsToLines(area, facts, now)}`)].join("\n");
  const named = facts.lead;
  const leadId = named?.kind === "one" ? data.queue.find((lead) => lead.name === named.name)?.id ?? null : null;
  return { text, areas: chosen, via: areas.length ? "rules" : "default", leadId };
}
