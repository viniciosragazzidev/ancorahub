import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { runGateway } from "@/features/ai-gateway/gateway";
import { maskPersonalData, shortName } from "@/features/ai-gateway/privacy";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { readLeadIntelligence } from "@/features/broker-workspace/chat/intelligence";
import { getBrokerClientWallet } from "@/features/customers/broker-client-wallet";
import { getBrokerHighlights } from "@/features/engagement/broker-stats";
import { RANK_LABEL } from "@/features/engagement/ranking";
import { getBrokerFinanceSummary } from "@/features/erp/broker-finance";
import { getSales, getSaleSummary } from "@/features/sales/queries";
import type { TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { areasOf, SASA_AREA_GUIDE, SASA_AREAS, type SasaArea } from "./ecosystem-areas";
import { resolveLead } from "./resolve-entities";

/**
 * Ferramentas de leitura da Sasá sobre o ecossistema do corretor (19/11). Uma por área, cada uma reaproveita a
 * consulta que a própria tela usa, com tenant, corretor e papel da sessão (nunca vindos da IA, nunca SQL livre).
 * Devolvem texto curto para o modelo resumir; nomes encurtados e dados pessoais mascarados.
 */
const TZ = "America/Sao_Paulo";
const hhmm = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const ddmm = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(date);
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cents = (value: number | null) => (value === null ? "sem dado" : brl(value / 100));
const minutesSince = (date: Date | null | undefined, now: Date) => (date ? Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000)) : null);
const waited = (minutes: number | null) => (minutes === null ? "" : minutes < 60 ? ` há ${minutes} min` : minutes < 48 * 60 ? ` há ${Math.round(minutes / 60)} h` : ` há ${Math.round(minutes / 1440)} dias`);

const STATUS: Record<string, string> = {
  new: "novo", distributed: "aguardando atendimento", in_contact: "em atendimento", quote_sent: "cotação enviada", negotiation: "em negociação",
  documentation_pending: "documentação pendente", under_analysis: "em análise", awaiting_reply: "aguardando resposta", converted: "convertido", lost: "perdido",
};

type Workspace = Awaited<ReturnType<typeof getCachedBrokerWorkspaceData>>;
type Read = (input: { context: TenantContext; question: string; data: Workspace; now: Date; leadHint: string | null }) => Promise<string[]>;

const READERS: Record<SasaArea, Read> = {
  async leads({ data, now }) {
    const byStatus = new Map<string, number>();
    for (const lead of data.queue) byStatus.set(lead.status, (byStatus.get(lead.status) ?? 0) + 1);
    const waiting = data.queue.filter((lead) => lead.nextAction && ["new_lead", "sla_risk", "sla_overdue", "awaiting_response"].includes(lead.nextAction.kind));
    return [
      `Leads ativos: ${data.queue.length} (${[...byStatus].map(([status, count]) => `${count} ${STATUS[status] ?? status}`).join(", ") || "nenhum"}).`,
      `Hoje: ${data.today.receivedToday} recebidos, ${data.today.acceptedToday} aceitos, ${data.today.inServiceNow} em atendimento, ${data.today.slaAtRiskNow} com 1º contato atrasando.`,
      waiting.length
        ? `Esperando o corretor: ${waiting.slice(0, 10).map((lead) => `${shortName(lead.name)} (${lead.nextAction!.kind === "awaiting_response" ? "respondeu" : lead.nextAction!.kind === "new_lead" ? "lead novo" : "1º contato"}${waited(minutesSince(lead.nextAction!.referenceAt ?? lead.arrivedAt, now))})`).join("; ")}.`
        : "Ninguém esperando o corretor agora.",
    ];
  },

  async lead({ context, question, data, leadHint }) {
    const match = resolveLead(question, data.queue.map((lead) => ({ id: lead.id, name: lead.name, status: lead.status })), leadHint);
    if (match.kind === "none") return ["Nenhum lead ativo do corretor com esse nome."];
    if (match.kind === "many") return [`Mais de um lead com esse nome: ${match.leads.map((lead) => `${shortName(lead.name)} (${STATUS[lead.status] ?? lead.status})`).join("; ")}. Peça para o corretor dizer o sobrenome.`];
    const db = getDatabase();
    // O lead veio da fila do próprio corretor (tenant e corretor da sessão): o histórico é dele.
    const [lead] = await db.select({ tipo: schema.leads.tipo, status: schema.leads.status, qualificationDetails: schema.leads.qualificationDetails, createdAt: schema.leads.createdAt })
      .from(schema.leads).where(and(eq(schema.leads.id, match.lead.id), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId))).limit(1);
    if (!lead) return ["Esse lead não está com o corretor."];
    const history = await db.select({ tipo: schema.leadInteractions.tipo, conteudo: schema.leadInteractions.conteudo, createdAt: schema.leadInteractions.createdAt })
      .from(schema.leadInteractions).where(eq(schema.leadInteractions.leadId, match.lead.id)).orderBy(desc(schema.leadInteractions.createdAt)).limit(8);
    const ai = readLeadIntelligence(lead.qualificationDetails);
    return [
      `Lead ${shortName(match.lead.name)}: etapa ${STATUS[lead.status] ?? lead.status}, tipo ${lead.tipo ?? "não informado"}, chegou em ${ddmm(lead.createdAt)}.`,
      ...(ai.summary ? [`Resumo da IA: ${maskPersonalData(ai.summary)}`] : []),
      ...(ai.objections?.length ? [`Objeções: ${ai.objections.join("; ")}`] : []),
      history.length
        ? `Histórico (mais recente primeiro): ${history.map((item) => `${ddmm(item.createdAt)} ${item.tipo === "note" ? "nota" : item.tipo}: ${maskPersonalData(item.conteudo).slice(0, 160)}`).join(" | ")}`
        : "Sem notas nem histórico registrado.",
    ];
  },

  async wallet({ context, now }) {
    const wallet = await getBrokerClientWallet(context, { view: "renewals", page: 1 }, now);
    const renewals = wallet.rows.slice(0, 6).map((row) => `${shortName(row.name)}${row.renewalWindowStartDate ? ` (renovação a partir de ${row.renewalWindowStartDate.split("-").reverse().slice(0, 2).join("/")})` : ""}`);
    return [
      `Carteira: ${wallet.walletCount} clientes; ${wallet.counts.attention} pedem atenção (retorno atrasado ou de hoje); ${wallet.counts.renewals} em janela de renovação.`,
      renewals.length ? `Renovações: ${renewals.join("; ")}.` : wallet.hasRenewalData ? "Nenhuma renovação próxima." : "Ainda não há datas de renovação registradas.",
    ];
  },

  async duty({ data }) {
    const lines: string[] = [];
    const active = data.duty?.activeAll?.length ? data.duty.activeAll : data.duty?.active ? [data.duty.active] : [];
    for (const duty of active) lines.push(`Plantão agora: ${duty.scheduleName}, ${hhmm(duty.startsAt)} às ${hhmm(duty.endsAt)}${duty.paused ? ", pausado" : ""}${duty.presenceStatus === "pending" ? ", presença a confirmar" : ""}.`);
    if (data.duty?.next) lines.push(`Próximo plantão: ${data.duty.next.scheduleName}, ${ddmm(data.duty.next.startsAt)} das ${hhmm(data.duty.next.startsAt)} às ${hhmm(data.duty.next.endsAt)}.`);
    lines.push(`Recebimento: ${data.viewer.availabilityStatus === "available" ? "recebendo leads" : data.viewer.availabilityStatus === "paused" ? "pausado" : "fora do ar"}.`);
    return lines;
  },

  async agenda({ data, now }) {
    if (!data.agenda.length) return ["Agenda sem retornos abertos."];
    const late = data.agenda.filter((item) => item.dueAt && item.dueAt.getTime() < now.getTime());
    return [
      `Retornos abertos: ${data.agenda.length}, ${late.length} atrasados.`,
      `Lista: ${data.agenda.slice(0, 10).map((item) => `${item.dueAt ? `${ddmm(item.dueAt)} ${hhmm(item.dueAt)}` : "sem hora"} ${shortName(item.leadName)} (${maskPersonalData(item.title)})`).join("; ")}.`,
    ];
  },

  async performance({ context, data, now }) {
    const lines = [`Hoje: ${data.today.receivedToday} recebidos, ${data.today.acceptedToday} aceitos, ${data.today.returnsDue} retornos, ${data.today.awaitingResponse} esperando resposta.`];
    if (data.goal) lines.push(`Meta: ${data.goal.name}, ${data.goal.currentValue} de ${data.goal.targetValue} (${data.goal.percentage}%).`);
    const highlights = await getBrokerHighlights(context.tenantId, context.userId, now).catch(() => null);
    if (highlights?.stats) lines.push(`Últimos 7 dias: ${highlights.stats.offered} ofertas, ${highlights.stats.accepted} aceitas${highlights.stats.medianAcceptSeconds ? `, aceite em ${Math.round(highlights.stats.medianAcceptSeconds)} s (mediana)` : ""}.`);
    if (highlights?.ranks.length) lines.push(`Ranking da semana: ${highlights.ranks.map((rank) => `${rank.position}º de ${rank.total} ${RANK_LABEL[rank.key]}`).join("; ")}.`);
    return lines;
  },

  async finance({ context, now }) {
    const summary = await getBrokerFinanceSummary(context, now).catch(() => null);
    if (!summary) return ["Comissões: o Meu financeiro não está liberado para este corretor (ou ainda não há dados)."];
    return [`Comissões (${summary.periodLabel}): a receber ${cents(summary.receivableCents)}; recebido no mês ${cents(summary.receivedThisMonthCents)}; adiantamentos em aberto ${cents(summary.openAdvancesCents)}.`];
  },

  async sales({ context }) {
    // Mesmo escopo da tela de vendas: o corretor só vê as próprias.
    const [summary, sales] = await Promise.all([getSaleSummary(), getSales()]);
    const own = sales.filter((sale) => sale.brokerId === context.userId && sale.status === "active");
    return [
      `Vendas registradas: ${summary.salesCount}, total ${brl(Number(summary.totalRevenue))}; comissões previstas ${brl(Number(summary.totalCommissions))} (${brl(Number(summary.pendingCommissions))} pendentes, ${brl(Number(summary.paidCommissions))} pagas).`,
      own.length ? `Últimas: ${own.slice(0, 5).map((sale) => `${ddmm(sale.saleDate)} ${shortName(sale.clientName ?? sale.leadName)}, ${[sale.carrierName, sale.planName].filter(Boolean).join(" ") || "plano não informado"}, ${brl(Number(sale.saleValue))}`).join("; ")}.` : "Nenhuma venda registrada ainda.",
    ];
  },

  async quotes({ context }) {
    const db = getDatabase();
    const [quotes, proposals] = await Promise.all([
      db.select({ leadName: schema.quotes.leadName, status: schema.quotes.status, total: schema.quotes.totalMonthly, createdAt: schema.quotes.createdAt })
        .from(schema.quotes).where(and(eq(schema.quotes.tenantId, context.tenantId), eq(schema.quotes.createdBy, context.userId))).orderBy(desc(schema.quotes.createdAt)).limit(5),
      db.select({ title: schema.proposals.title, leadName: schema.proposals.leadName, status: schema.proposals.status, total: schema.proposals.totalMonthly, createdAt: schema.proposals.createdAt })
        .from(schema.proposals).where(and(eq(schema.proposals.tenantId, context.tenantId), eq(schema.proposals.createdBy, context.userId))).orderBy(desc(schema.proposals.createdAt)).limit(5),
    ]);
    return [
      quotes.length ? `Últimas cotações: ${quotes.map((quote) => `${ddmm(quote.createdAt)} ${shortName(quote.leadName ?? "cliente")} (${quote.status}${quote.total ? `, ${brl(Number(quote.total))}/mês` : ""})`).join("; ")}.` : "Nenhuma cotação salva.",
      proposals.length ? `Últimas propostas: ${proposals.map((proposal) => `${ddmm(proposal.createdAt)} ${shortName(proposal.leadName)} (${proposal.status}, ${brl(Number(proposal.total))}/mês)`).join("; ")}.` : "Nenhuma proposta.",
    ];
  },

  async notifications({ context }) {
    const rows = await getDatabase().select({ title: schema.notifications.title, readAt: schema.notifications.readAt, createdAt: schema.notifications.createdAt })
      .from(schema.notifications).where(and(eq(schema.notifications.tenantId, context.tenantId), eq(schema.notifications.recipientUserId, context.userId)))
      .orderBy(desc(schema.notifications.createdAt)).limit(8);
    const unread = rows.filter((row) => !row.readAt).length;
    return rows.length ? [`Avisos recentes (${unread} não lidos): ${rows.map((row) => `${ddmm(row.createdAt)} ${maskPersonalData(row.title)}${row.readAt ? "" : " (novo)"}`).join("; ")}.`] : ["Nenhum aviso."];
  },
};

const routerSchema = z.object({ areas: z.array(z.enum(SASA_AREAS)).max(3).default([]), lead: z.string().trim().max(80).nullish() });

/** A IA escolhe as ferramentas numa lista fechada, quando as palavras da pergunta não bastam. */
async function routeWithAi(context: TenantContext, question: string, leadFirstNames: string[]) {
  const result = await runGateway({
    profile: "chat-fast", purpose: "sasa_ask_router", tenantId: context.tenantId, userId: context.userId, sensitive: true, maskPersonalData: true,
    maxTokens: 80, temperature: 0, totalTimeoutMs: 8_000, schema: routerSchema,
    messages: [
      { role: "system", content: `Escolha de 1 a 3 fontes de dados para responder a pergunta de um corretor de plano de saúde. Fontes:\n${SASA_AREAS.map((area) => `${area}: ${SASA_AREA_GUIDE[area]}`).join("\n")}\nSe a pergunta for sobre um cliente específico, use "lead" e copie o nome em "lead". Responda APENAS um JSON: {"areas": string[], "lead"?: string}.` },
      { role: "user", content: `Primeiros nomes dos leads: ${leadFirstNames.slice(0, 40).join(", ") || "nenhum"}.\nPERGUNTA: ${question}` },
    ],
  });
  return result.ok ? result.value : null;
}

/** Áreas da pergunta: um nome de lead conhecido puxa "lead"; palavras puxam o resto; sem nada, a IA escolhe. */
export async function sasaAreasFor(context: TenantContext, question: string, data: Workspace): Promise<{ areas: SasaArea[]; leadHint: string | null; via: "rules" | "ai" | "default" }> {
  const areas = areasOf(question);
  const named = resolveLead(question, data.queue.map((lead) => ({ id: lead.id, name: lead.name, status: lead.status })));
  if (named.kind !== "none" && !areas.includes("lead")) areas.unshift("lead");
  if (areas.length) return { areas: areas.slice(0, 3), leadHint: null, via: "rules" };
  const routed = await routeWithAi(context, question, [...new Set(data.queue.map((lead) => lead.name.split(" ")[0] ?? lead.name))]).catch(() => null);
  if (routed?.areas.length) return { areas: routed.areas, leadHint: routed.lead ?? null, via: "ai" };
  return { areas: ["leads", "agenda", "performance"], leadHint: null, via: "default" };
}

/** Texto de contexto das áreas pedidas (cada ferramenta falha sozinha, sem derrubar a resposta). */
export async function sasaEcosystemContext(context: TenantContext, question: string, now = new Date()) {
  const data = await getCachedBrokerWorkspaceData();
  const { areas, leadHint, via } = await sasaAreasFor(context, question, data);
  const sections = await Promise.all(areas.map(async (area) => {
    const lines = await READERS[area]({ context, question, data, now, leadHint }).catch((error) => {
      console.error(`[sasa] read ${area} failed`, error);
      return ["Não consegui ler esses dados agora."];
    });
    return `[${area}]\n${lines.join("\n")}`;
  }));
  const header = `Corretor: ${data.viewer.name.split(/\s+/)[0]}. Unidade: ${data.viewer.branchName}. Agora: ${ddmm(now)} ${hhmm(now)}.`;
  return { text: [header, ...sections].join("\n\n"), areas, via, leadId: data.queue.find((lead) => leadHint && lead.name.toLowerCase().includes(leadHint.toLowerCase()))?.id ?? null };
}
