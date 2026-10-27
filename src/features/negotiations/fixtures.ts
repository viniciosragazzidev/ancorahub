import type { NegotiationBrokerStats, NegotiationDayStats, NegotiationLead, NegotiationsDashboardData, NegotiationsScope } from "./queries";
import type { NegotiationLevel } from "./negotiation-model";

const NOW = new Date("2026-10-27T15:00:00.000Z");
const LEVELS: NegotiationLevel[] = ["closing", "advanced", "in_conversation", "cooling", "no_crm_conversation"];
const BRANCHES = [
  { id: "branch-centro", name: "Unidade Centro" },
  { id: "branch-norte", name: "Unidade Norte" },
  { id: "branch-sul", name: "Unidade Sul" },
];
const BROKERS = [
  { id: "broker-ana", name: "Ana Luiza Monteiro da Silva" },
  { id: "broker-bruno", name: "Bruno Henrique Azevedo" },
  { id: "broker-carolina", name: "Carolina Ribeiro Martins" },
  { id: "broker-diego", name: "Diego Costa Almeida" },
];

function isoDaysAgo(days: number, hour = 15) {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function newLead(index: number): NegotiationLead {
  const level = LEVELS[index % LEVELS.length]!;
  const branch = BRANCHES[index % BRANCHES.length]!;
  const broker = BROKERS[index % BROKERS.length]!;
  const waiting = level === "cooling" || index % 7 === 0;
  const staleDays = level === "cooling" ? 4 : index % 3;
  const status = level === "closing" ? "under_analysis" : level === "advanced" ? "negotiation" : level === "no_crm_conversation" ? "quote_sent" : "in_contact";
  const lastCustomerMessageAt = level === "no_crm_conversation" ? null : isoDaysAgo(staleDays, waiting ? 9 : 14);
  const lastBrokerMessageAt = level === "no_crm_conversation" ? null : isoDaysAgo(staleDays, waiting ? 8 : 13);
  const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

  return {
    id,
    name: ["Mariana Oliveira", "Rafael de Souza", "Juliana Ferreira", "Pedro Henrique", "Fernanda Costa", "Marcelo Augusto", "Beatriz Almeida", "Luiz Felipe", "Isabela Mendes", "Gustavo Rocha"][index % 10] + (index > 9 ? ` ${index + 1}` : ""),
    status,
    stageEnteredAt: isoDaysAgo(index % 3 === 0 ? 0 : (index % 6) + 1),
    daysAtStage: (index % 6) + 1,
    assignedAt: isoDaysAgo(14),
    firstContactAt: isoDaysAgo(12),
    firstContactLatencySeconds: 900 + (index % 8) * 240,
    brokerId: broker.id,
    brokerName: broker.name,
    branchId: branch.id,
    branchName: branch.name,
    level,
    lastCustomerMessageAt,
    lastBrokerMessageAt,
    lastExchangeAt: level === "no_crm_conversation" ? null : lastBrokerMessageAt,
    customerWaiting: waiting,
    replyOwedBy: waiting ? "broker" : level === "no_crm_conversation" ? "none" : "customer",
    statusBehindAi: index % 9 === 0,
    hasCrmConversation: level !== "no_crm_conversation",
    customerSentPdf: level === "closing" && index % 2 === 0,
    customerSentImage: level === "closing" && index % 2 === 1,
    ai: {
      conversationStage: level === "closing" ? "DOCUMENT_COLLECTION" : level === "advanced" ? "NEGOTIATION" : "DISCOVERY",
      customerIntent: index % 2 === 0 ? "buy" : "compare",
      pendingFrom: waiting ? "broker" : null,
      summary: `Cliente busca uma opção de saúde para a família e pediu detalhes sobre rede credenciada, carências e valores. Atendimento iniciado por ${broker.name}.`,
      nextBestAction: waiting ? "Retomar contato e responder às dúvidas sobre cobertura." : "Confirmar a faixa de preço e apresentar a próxima opção.",
      risk: index % 8 === 0 ? "Cliente mencionou que está avaliando outra proposta." : null,
      objections: index % 3 === 0 ? ["Quer comparar a rede credenciada", "Precisa confirmar o valor mensal"] : [],
      buyingSignals: index % 2 === 0 ? ["Informou a quantidade de pessoas", "Pediu prazo para começar"] : [],
      lastAnalyzedAt: isoDaysAgo(0, 14),
    },
  };
}

function buildBrokerStats(leads: NegotiationLead[]): NegotiationBrokerStats[] {
  const groups = new Map<string, NegotiationBrokerStats>();
  for (const lead of leads) {
    const existing = groups.get(lead.brokerId) ?? {
      brokerId: lead.brokerId,
      brokerName: lead.brokerName,
      total: 0,
      levels: { closing: 0, advanced: 0, in_conversation: 0, cooling: 0, no_crm_conversation: 0 },
      customersWaiting: 0,
      averageFirstResponseSeconds: 1_800,
      averageReplySeconds: 3_600,
      crmConversationPercent: 0,
    };
    existing.total += 1;
    existing.levels[lead.level] += 1;
    existing.customersWaiting += lead.customerWaiting ? 1 : 0;
    if (lead.hasCrmConversation) existing.crmConversationPercent += 1;
    groups.set(lead.brokerId, existing);
  }
  return [...groups.values()].map((item) => ({
    ...item,
    crmConversationPercent: item.total ? Math.round((item.crmConversationPercent / item.total) * 100) : 0,
  }));
}

function buildDailyStats(): NegotiationDayStats[] {
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(NOW);
    day.setUTCDate(day.getUTCDate() - (6 - offset));
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
    const label = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit" }).format(day);
    return { day: key, label, leadsWithExchange: 4 + (offset % 8), brokerMessages: 8 + offset * 2, currentlyAdvanced: offset % 3, currentlyClosing: offset === 5 ? 1 : 0 };
  });
}

export function createNegotiationsFixture(role: NegotiationsScope["role"] = "director"): NegotiationsDashboardData {
  const allLeads = Array.from({ length: 30 }, (_, index) => newLead(index));
  const leads = role === "manager"
    ? allLeads.filter((lead) => lead.branchId === BRANCHES[0]!.id)
    : role === "supervisor"
      ? allLeads.filter((lead) => lead.brokerId === BROKERS[0]!.id || lead.brokerId === BROKERS[1]!.id)
      : allLeads;
  const scope: NegotiationsScope = {
    role,
    branchId: role === "manager" ? BRANCHES[0]!.id : null,
    branchName: role === "manager" ? BRANCHES[0]!.name : null,
    branches: role === "director" ? BRANCHES : [],
    supervisorId: role === "supervisor" ? "supervisor-fixture" : null,
    scopeMessage: null,
  };
  const counts: NegotiationsDashboardData["counts"] = { closing: 0, advanced: 0, in_conversation: 0, cooling: 0, no_crm_conversation: 0, customers_waiting: 0 };
  for (const lead of leads) {
    counts[lead.level] += 1;
    counts.customers_waiting += lead.customerWaiting ? 1 : 0;
  }
  return {
    generatedAt: NOW.toISOString(),
    scope,
    leads,
    brokers: [...new Map(leads.map((lead) => [lead.brokerId, { id: lead.brokerId, name: lead.brokerName }])).values()],
    counts,
    brokerStats: buildBrokerStats(leads),
    dailyStats: buildDailyStats(),
    aiHealth: { analysesLast24Hours: 26, failuresLast24Hours: 2 },
  };
}
