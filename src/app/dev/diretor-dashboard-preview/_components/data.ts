/**
 * Example data for the director dashboard preview, typed with the same types the real queries return
 * (type-only imports: nothing from the server modules reaches the client bundle).
 * A broker house with 60 brokers in 3 units. Deterministic: the same filters give the same numbers.
 */
import type { CommandCenterData } from "@/features/dashboard/today";
import type { QualificationFunnel, FunnelPeriod } from "@/features/qualification-turbo/funnel";
import type { LeadQualityReport, LeadQualitySegment, SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";
import type { LeadQualityDimension } from "@/features/reports/metrics/lead-quality-contract";
import type { DrilldownId, DrilldownResult } from "@/features/reports/metrics/metrics-service";

/** Fixed clock: the server and the client render the same text. Saturday, 24/10/2026, 13:42 in Brasília. */
export const NOW_ISO = "2026-10-24T16:42:00.000Z";

export type UnitId = "all" | "centro" | "nova-iguacu" | "barra";
export const UNITS: Array<{ id: UnitId; name: string; share: number }> = [
  { id: "all", name: "Todas as unidades", share: 1 },
  { id: "centro", name: "Centro", share: 0.45 },
  { id: "nova-iguacu", name: "Nova Iguaçu", share: 0.33 },
  { id: "barra", name: "Barra da Tijuca", share: 0.22 },
];
export const unitOf = (id: UnitId) => UNITS.find((unit) => unit.id === id) ?? UNITS[0];

export type OverviewPeriod = "today" | 7 | 30;
export const OVERVIEW_PERIODS: Array<{ value: OverviewPeriod; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
];
export const FUNNEL_PERIOD_OPTIONS: Array<{ value: FunnelPeriod; label: string }> = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];
export type QualityPeriod = "today" | 3 | 7 | 14 | 30 | 90;
export const QUALITY_PERIODS: Array<{ value: QualityPeriod; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: 3, label: "3 dias" },
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

/* ------------------------------------------------------------------ helpers */

function seeded(seed: number) {
  let state = seed % 2147483647 || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
const round = (value: number) => Math.max(0, Math.round(value));
const ago = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Hugo", "Isabela", "João", "Karina", "Leonardo", "Mariana", "Nicolas", "Olívia", "Paulo", "Rafaela", "Sérgio", "Tatiane", "Vitor"];
const LAST = ["Souza", "Lima", "Ferreira", "Almeida", "Costa", "Ribeiro", "Martins", "Barbosa", "Carvalho", "Gomes", "Rocha", "Moreira"];
const UNIT_IDS: Exclude<UnitId, "all">[] = ["centro", "nova-iguacu", "barra"];

/** 60 active brokers: 27 Centro, 20 Nova Iguaçu, 13 Barra. 52 with WhatsApp connected. */
export const BROKERS = Array.from({ length: 60 }, (_, index) => {
  const unit: Exclude<UnitId, "all"> = index < 27 ? "centro" : index < 47 ? "nova-iguacu" : "barra";
  return {
    id: `b${index + 1}`,
    name: `${FIRST[(index * 7) % FIRST.length]} ${LAST[(index * 5 + Math.floor(index / 20)) % LAST.length]}`,
    unit,
    connected: ![3, 9, 16, 24, 31, 40, 50, 57].includes(index),
    leadCount: round(((index * 37) % 19) + (index % 3 === 0 ? 4 : 0)),
  };
});

const LEAD_NAMES = ["Carla Mendes", "Roberto Alves", "Juliana Prado", "Marcos Teixeira", "Fernanda Lopes", "Lucas Martins", "Patrícia Rocha", "Eduardo Nunes", "Sabrina Costa", "Thiago Ramos", "Aline Duarte", "Rodrigo Pires", "Vanessa Melo", "Felipe Antunes", "Camila Freitas", "Gustavo Reis", "Larissa Pacheco", "Henrique Brito", "Bianca Moura", "Otávio Siqueira"];
export const nextLeadName = (index: number) => LEAD_NAMES[index % LEAD_NAMES.length];

export const QUEUES = [
  { id: "q-meta-pf", name: "Meta pessoa física", hue: 210, weight: 0.38 },
  { id: "q-meta-pme", name: "Meta PME", hue: 150, weight: 0.24 },
  { id: "q-whatsapp", name: "WhatsApp orgânico", hue: 28, weight: 0.17 },
  { id: "q-site", name: "Site e Google", hue: 268, weight: 0.12 },
  { id: "q-indicacao", name: "Indicação", hue: 330, weight: 0.06 },
  { id: null, name: "Sem fila", hue: null, weight: 0.03 },
] as const;

/* ------------------------------------------------------------------ overview (command center) */

const OVERVIEW_SCALE: Record<string, number> = { today: 1, 7: 6.6, 30: 27.5 };

/** Window the real query returns: N operation days (19:00 in Brasília, 22:00Z) ending with today's. */
function overviewWindow(period: OverviewPeriod, unitId: UnitId, now: Date): CommandCenterData["today"]["window"] {
  const turn = new Date(now);
  turn.setUTCHours(22, 0, 0, 0);
  if (turn > now) turn.setUTCDate(turn.getUTCDate() - 1);
  turn.setUTCDate(turn.getUTCDate() - ((period === "today" ? 1 : period) - 1));
  return { period: period === "today" ? "today" : period === 7 ? "7d" : "30d", start: turn.toISOString(), end: now.toISOString(), branchId: unitId === "all" ? null : unitId };
}

/** "Respostas no WhatsApp" is always the last 7 days. */
const activityWindow = (now: Date) => ({ start: new Date(now.getTime() - 7 * 86_400_000).toISOString(), end: now.toISOString() });

export function buildCommandCenter(period: OverviewPeriod, unitId: UnitId, now: Date): CommandCenterData {
  const unit = unitOf(unitId);
  const scale = OVERVIEW_SCALE[String(period)] * unit.share;
  const received = round(148 * scale);
  const distributed = round(131 * scale);
  // Waiting and without first contact are "right now" (any day): the period does not change them.
  const waiting = round(9 * unit.share) || (unitId === "barra" ? 2 : 0);
  const withoutFirstContact = round(14 * unit.share);
  const random = seeded(String(period).length * 31 + unit.share * 1000);
  const queues = QUEUES.map((queue) => ({
    id: queue.id,
    name: queue.name,
    hue: queue.hue,
    today: round(received * queue.weight * (0.9 + random() * 0.2)),
    waiting: 0,
  }));
  let left = waiting;
  for (const queue of queues) {
    if (!left) break;
    const take = Math.min(left, Math.max(1, Math.round(waiting * 0.45)));
    queue.waiting = take;
    left -= take;
  }
  queues.sort((a, b) => b.today - a.today || b.waiting - a.waiting);

  const brokers = BROKERS.filter((broker) => unitId === "all" || broker.unit === unitId);
  const notConnected = brokers.filter((broker) => !broker.connected).map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const connectedBrokers = brokers
    .filter((broker) => broker.connected)
    // "Respostas no WhatsApp" is always the last 7 days, whatever the period of the page.
    .map((broker) => ({ id: broker.id, name: broker.name, leadCount: broker.leadCount }))
    .sort((a, b) => b.leadCount - a.leadCount || a.name.localeCompare(b.name, "pt-BR"));

  const duties = [
    { scheduleId: "d-pf-tarde", name: "Plantão pessoa física tarde", dutyDate: "2026-10-24", startsAt: "13:00", endsAt: "19:00", running: true, queueName: "Meta pessoa física", brokerCount: 14, minimumBrokers: 12, unit: "centro" },
    { scheduleId: "d-pme", name: "Plantão PME", dutyDate: "2026-10-24", startsAt: "09:00", endsAt: "18:00", running: true, queueName: "Meta PME", brokerCount: 4, minimumBrokers: 6, unit: "nova-iguacu" },
    { scheduleId: "d-presencial", name: "Presencial Barra", dutyDate: "2026-10-24", startsAt: "10:00", endsAt: "16:00", running: true, queueName: "Indicação", brokerCount: 3, minimumBrokers: 3, unit: "barra" },
  ].filter((duty) => unitId === "all" || duty.unit === unitId).map(({ unit: dutyUnit, ...duty }) => { void dutyUnit; return duty; });

  const attention = [
    { id: "high-intent-unassigned", title: "Leads com alta intenção aguardando corretor", description: "Qualificação hot sem corretor responsável.", count: round(3 * unit.share) || 1, href: "/dashboard/drill/high-intent-unassigned?period=7" },
    { id: "out-of-sla", title: "Primeiro atendimento fora do SLA", description: "Distribuídos no período com latência acima de 15 min ou sem contato dentro do prazo.", count: round(8 * unit.share), href: "/dashboard/drill/out-of-sla?period=7" },
    { id: "stale-negotiations", title: "Negociações paradas", description: "Sem avanço de etapa há mais de 5 dias.", count: round(12 * unit.share), href: "/dashboard/drill/stale-negotiations?period=7" },
    { id: "brokers-over-capacity", title: "Corretores acima da capacidade", description: "Carteira ativa acima da capacidade da fila responsável.", count: unitId === "barra" ? 0 : unitId === "all" ? 2 : 1, href: "/dashboard/drill/brokers-over-capacity?period=7" },
  ].filter((item) => item.count > 0).map((item) => ({ ...item, tone: item.count > 5 ? ("danger" as const) : ("warning" as const) }));

  const branch = (index: number) => (unitId === "all" ? unitOf(UNIT_IDS[index % 3]).name : unit.name);
  const statuses = ["new", "distributed", "in_contact", "distributed", "quote_sent", "in_contact"] as const;
  const minutes = [2, 9, 17, 31, 48, 75];
  const recentLeads = minutes.map((minute, index) => ({
    id: `l-${unitId}-${index}`,
    name: LEAD_NAMES[(index * 3 + unit.name.length) % LEAD_NAMES.length],
    status: statuses[index],
    branchName: index === 4 && unitId === "all" ? null : branch(index),
    createdAt: ago(now, minute),
  }));

  return {
    today: { received, distributed, waiting, withoutFirstContact, queues, window: overviewWindow(period, unitId, now) },
    welcome: {
      firstName: "Renata",
      nextDuty: { scheduleId: "d-noite", name: "Plantão noite", dutyDate: "2026-10-24", startsAt: "19:00", endsAt: "23:00", running: false, queueName: "Meta pessoa física", brokerCount: 9, minimumBrokers: 8 },
      runningDuties: duties,
      pulse: { activeQueues: 5, runningDuties: duties.length, brokersOnDutyNow: duties.reduce((sum, duty) => sum + duty.brokerCount, 0) },
    },
    whatsapp: {
      total: brokers.length,
      connected: brokers.length - notConnected.length,
      notConnected: notConnected.slice(0, 6),
      activity: {
        connectedBrokerCount: connectedBrokers.length,
        totalLeads: connectedBrokers.reduce((sum, broker) => sum + broker.leadCount, 0),
        brokers: connectedBrokers,
      },
      activityWindow: activityWindow(now),
    },
    attention,
    recentLeads,
    generatedAt: now.toISOString(),
  };
}

export function emptyCommandCenter(now: Date): CommandCenterData {
  return {
    today: { received: 0, distributed: 0, waiting: 0, withoutFirstContact: 0, queues: [], window: overviewWindow("today", "all", now) },
    welcome: { firstName: "Renata", nextDuty: null, runningDuties: [], pulse: { activeQueues: 0, runningDuties: 0, brokersOnDutyNow: 0 } },
    whatsapp: { total: 0, connected: 0, notConnected: [], activity: { connectedBrokerCount: 0, totalLeads: 0, brokers: [] }, activityWindow: activityWindow(now) },
    attention: [],
    recentLeads: [],
    generatedAt: now.toISOString(),
  };
}

/* ------------------------------------------------------------------ drills */

const DRILL_TEXT: Record<DrilldownId, { title: string; explanation: string }> = {
  converted: { title: "Leads convertidos", explanation: "Leads que chegaram no período e viraram venda." },
  "not-converted": { title: "Leads não convertidos", explanation: "Leads que chegaram no período e ainda não viraram venda." },
  lost: { title: "Leads perdidos", explanation: "Leads que chegaram no período e foram marcados como perdidos." },
  "out-of-sla": { title: "Primeiro atendimento fora do SLA", explanation: "Leads distribuídos no período em que o corretor demorou mais que o SLA para o primeiro contato, ou ainda não fez contato dentro do prazo." },
  "stale-negotiations": { title: "Negociações paradas", explanation: "Leads em negociação, documentação ou análise que estão na mesma etapa há mais tempo que o prazo de estagnação." },
  "high-intent-unassigned": { title: "Alta intenção sem corretor", explanation: "Leads ativos com qualificação quente e sem corretor responsável." },
  "brokers-over-capacity": { title: "Corretores acima da capacidade", explanation: "Corretores com mais leads ativos do que a capacidade configurada na fila responsável." },
};

export function buildDrill(id: DrilldownId, total: number, unitId: UnitId, now: Date): DrilldownResult {
  const text = DRILL_TEXT[id];
  const random = seeded(id.length * 97 + total);
  const brokers = BROKERS.filter((broker) => unitId === "all" || broker.unit === unitId);
  const statusById: Record<DrilldownId, string[]> = {
    converted: ["converted"],
    "not-converted": ["in_contact", "quote_sent", "negotiation"],
    lost: ["lost"],
    "out-of-sla": ["distributed", "new"],
    "stale-negotiations": ["negotiation", "documentation_pending", "under_analysis"],
    "high-intent-unassigned": ["new"],
    "brokers-over-capacity": [],
  };
  if (id === "brokers-over-capacity") {
    const over = brokers.slice(0, Math.max(total, 0)).map((broker, index) => ({ brokerId: broker.id, brokerName: broker.name, activeLeads: 34 + index * 3, capacity: 30 }));
    return { id, ...text, total: over.length, rows: [], brokers: over };
  }
  const rows = Array.from({ length: Math.min(total, 12) }, (_, index) => {
    const broker = brokers[Math.floor(random() * brokers.length)];
    const created = new Date(now.getTime() - (20 + index * 95 + random() * 60) * 60_000);
    const statuses = statusById[id];
    return {
      id: `${id}-${index}`,
      nome: LEAD_NAMES[(index * 7 + id.length) % LEAD_NAMES.length],
      status: statuses[index % statuses.length],
      brokerName: id === "high-intent-unassigned" ? null : broker?.name ?? null,
      branchName: broker ? unitOf(broker.unit).name : null,
      createdAt: created,
      firstContactAt: id === "out-of-sla" && index % 2 ? new Date(created.getTime() + 31 * 60_000) : null,
      latencySeconds: id === "out-of-sla" && index % 2 ? 31 * 60 : null,
    };
  });
  return { id, ...text, total, rows, brokers: [] };
}

/* ------------------------------------------------------------------ funnel */

const FUNNEL_SCALE: Record<FunnelPeriod, number> = { 7: 1, 30: 4.2, 90: 12.1 };

export function buildFunnel(period: FunnelPeriod, unitId: UnitId, now: Date): QualificationFunnel {
  const unit = unitOf(unitId);
  const scale = FUNNEL_SCALE[period] * unit.share;
  const arrived = round(1004 * scale);
  const counts = { sent: 0.964, delivered: 0.937, read: 0.809, replied: 0.453, qualified: 0.286, with_broker: 0.261, converted: 0.031 };
  const stages = [
    { key: "arrived", label: "Chegaram", count: arrived },
    { key: "sent", label: "1ª mensagem enviada", count: round(arrived * counts.sent) },
    { key: "delivered", label: "Entregue", count: round(arrived * counts.delivered) },
    { key: "read", label: "Lida", count: round(arrived * counts.read) },
    { key: "replied", label: "Respondeu", count: round(arrived * counts.replied) },
    { key: "qualified", label: "Qualificado", count: round(arrived * counts.qualified) },
    { key: "with_broker", label: "Com corretor", count: round(arrived * counts.with_broker) },
    { key: "converted", label: "Venda", count: round(arrived * counts.converted) },
  ];
  const since = new Date(now.getTime() - period * 86_400_000).toISOString();
  const nowRows = [
    { key: "qualifying", label: "Em qualificação", count: round(arrived * 0.07), hint: "Conversando com a IA agora." },
    { key: "ready", label: "Prontos esperando corretor", count: round(arrived * 0.012), hint: "Qualificados, ainda sem corretor." },
    { key: "in_service", label: "Em atendimento", count: round(arrived * 0.22), hint: "Com um corretor, sem venda ainda." },
    { key: "no_reply", label: "Sem resposta", count: round(arrived * 0.41), hint: "Recebem lembretes de 20 min, 3 h e ligação." },
    { key: "unreachable", label: "Fora de alcance", count: round(arrived * 0.06), hint: "Mensagem não entregue ou número inválido." },
    { key: "lost", label: "Perdidos", count: round(arrived * 0.197), hint: "Marcados como perdidos pelo corretor ou pela IA." },
    { key: "sold", label: "Vendas", count: stages[7].count, hint: "Venda registrada." },
  ];
  const sent = stages[1].count;
  const variants = [
    { approach: "Saudação curta", variant: "a", label: "Oi, aqui é da Âncora Saúde. Posso te ajudar com o plano?", share: 0.36, rate: 0.49, qualified: 0.31 },
    { approach: "Pergunta direta", variant: "b", label: "Para quantas pessoas é o plano que você procura?", share: 0.34, rate: 0.46, qualified: 0.3 },
    { approach: "Com nome do corretor", variant: "c", label: "Sou a Ana, da Âncora Saúde. Vi seu pedido de cotação.", share: 0.3, rate: 0.41, qualified: 0.25 },
  ].map(({ share: variantShare, rate, qualified, ...rest }) => {
    const variantSent = round(sent * variantShare);
    const margin = variantSent ? 1.96 * Math.sqrt((rate * (1 - rate)) / variantSent) : 0;
    return { ...rest, sent: variantSent, replied: round(variantSent * rate), qualified: round(variantSent * qualified), rate, low: Math.max(0, rate - margin), high: Math.min(1, rate + margin) };
  });
  const replied = stages[4].count;
  const touches = [
    { touch: "first", label: "1ª mensagem", sent, repliesAfter: round(replied * 0.58) },
    { touch: "reminder_20m", label: "Lembrete de 20 min", sent: round(sent * 0.6), repliesAfter: round(replied * 0.19) },
    { touch: "reminder_3h", label: "Lembrete de 3 h", sent: round(sent * 0.48), repliesAfter: round(replied * 0.12) },
    { touch: "call", label: "Ligação", sent: round(sent * 0.3), repliesAfter: round(replied * 0.07) },
    { touch: "farewell", label: "Despedida", sent: round(sent * 0.25), repliesAfter: round(replied * 0.04) },
  ];
  const lost = nowRows[5].count;
  const lossReasons = [
    { label: "Preço acima do esperado", count: round(lost * 0.31) },
    { label: "Não respondeu mais", count: round(lost * 0.24) },
    { label: "Fechou com outra corretora", count: round(lost * 0.16) },
    { label: "Sem interesse no momento", count: round(lost * 0.13) },
    { label: "Rede credenciada não atende", count: round(lost * 0.09) },
    { label: "Carência", count: round(lost * 0.07) },
  ];
  const delivered = stages[2].count;
  const marketingCount = round(delivered * 0.58);
  const utilityCount = round(delivered * 1.9);
  const marketing = Math.round(marketingCount * 0.3217 * 100) / 100;
  const utility = Math.round(utilityCount * 0.035 * 100) / 100;
  const qualifiedCount = stages[5].count;
  return {
    period,
    since,
    stages,
    medianMinutesToReply: arrived ? 6 : null,
    now: nowRows,
    lossReasons: lost ? lossReasons : [],
    variants: arrived ? variants : [],
    touches,
    // Company-wide only: a unit's numbers would not match Meta's bill.
    cost: unitId === "all" ? { total: Math.round((marketing + utility) * 100) / 100, marketing, utility, templatesDelivered: marketingCount + utilityCount, perQualified: qualifiedCount ? Math.round(((marketing + utility) / qualifiedCount) * 100) / 100 : null, source: "meta" } : null,
  };
}

/* ------------------------------------------------------------------ quality */

const QUALITY_TOTAL: Record<string, number> = { today: 148, 3: 430, 7: 1004, 14: 2010, 30: 4220, 90: 12400 };

function segmentRow(dimension: LeadQualityDimension, key: string, label: string, total: number, bias: number, random: () => number): LeadQualitySegment {
  const hot = round(total * 0.14 * bias);
  const warm = round(total * 0.27 * bias);
  const unclassified = round(total * 0.16);
  const cold = Math.max(0, total - hot - warm - unclassified);
  const converted = round(total * 0.034 * bias * (0.8 + random() * 0.4));
  const classified = hot + warm + cold;
  const assigned = round(total * 0.88);
  const assignedInShift = round(total * 0.79);
  return {
    dimension, key, label, total, hot, warm, cold, unclassified, converted,
    hotWarmConverted: round(converted * 0.72),
    assigned, assignedInShift, assignedAfterShift: round(total * 0.06),
    metaAttributed: round(total * 0.7),
    averageFirstContactSeconds: round(240 + random() * 600),
    hotWarmShare: classified ? Math.round(((hot + warm) / classified) * 1000) / 10 : 0,
    conversionRate: total ? Math.round((converted / total) * 1000) / 10 : 0,
  };
}

function segments(dimension: LeadQualityDimension, entries: Array<[string, string, number, number?]>, total: number, random: () => number) {
  const weight = entries.reduce((sum, entry) => sum + entry[2], 0);
  return entries
    .map(([key, label, w, bias]) => segmentRow(dimension, key, label, round((total * w) / weight), bias ?? 1, random))
    .filter((row) => row.total >= 3)
    .sort((a, b) => b.total - a.total);
}

export function buildQualityReport(period: QualityPeriod, unitId: UnitId, queueId: string | null, now: Date): LeadQualityReport {
  const unit = unitOf(unitId);
  const queueShare = queueId ? QUEUES.find((queue) => queue.id === queueId)?.weight ?? 1 : 1;
  const total = round(QUALITY_TOTAL[String(period)] * unit.share * queueShare);
  const random = seeded(total * 13 + 7);
  const base = segmentRow("source", "all", "Todos", total, 1, random);
  const classified = base.hot + base.warm + base.cold;
  const days = period === "today" ? 1 : period;
  const hourWeight = (hour: number) => (hour >= 8 && hour <= 22 ? 1 + Math.sin(((hour - 8) / 14) * Math.PI) * 1.6 : 0.25);
  const hourEntries: Array<[string, string, number]> = [];
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) hourEntries.push([`${day}:${hour}`, `${day}:${hour}`, hourWeight(hour) * (day === 0 ? 0.55 : day === 6 ? 0.7 : 1)]);
  }
  const report: LeadQualityReport = {
    enabled: true,
    period,
    window: { since: new Date(now.getTime() - days * 86_400_000).toISOString(), until: null },
    filters: { queueId, origin: null },
    generatedAt: now.toISOString(),
    summary: {
      total,
      hot: base.hot, warm: base.warm, cold: base.cold, unclassified: base.unclassified, classified,
      converted: base.converted, hotWarmConverted: base.hotWarmConverted,
      assigned: base.assigned, assignedInShift: base.assignedInShift,
      assignedInShiftRate: total ? Math.round((base.assignedInShift / total) * 1000) / 10 : 0,
      assignedAfterShift: base.assignedAfterShift, metaAttributed: base.metaAttributed,
      averageFirstContactSeconds: total ? 412 : null,
      classificationCoverage: total ? Math.round((classified / total) * 1000) / 10 : 0,
      hotWarmShare: base.hotWarmShare,
      hotWarmConversionRate: base.hot + base.warm ? Math.round((base.hotWarmConverted / (base.hot + base.warm)) * 1000) / 10 : 0,
      conversionRate: base.conversionRate,
      assignedRate: total ? Math.round((base.assigned / total) * 1000) / 10 : 0,
      metaAdAttributionCoverage: total ? Math.round((base.metaAttributed / total) * 1000) / 10 : 0,
      temperatureDistribution: {
        hot: total ? Math.round((base.hot / total) * 1000) / 10 : 0,
        warm: total ? Math.round((base.warm / total) * 1000) / 10 : 0,
        cold: total ? Math.round((base.cold / total) * 1000) / 10 : 0,
        unclassified: total ? Math.round((base.unclassified / total) * 1000) / 10 : 0,
      },
    },
    segments: {
      source: segments("source", [["meta", "Meta", 6, 1], ["whatsapp", "WhatsApp", 2.4, 1.15], ["website", "Site", 1, 1.1], ["referral", "Indicação", 0.4, 1.5], ["manual", "Cadastro manual", 0.2, 0.9]], total, random),
      campaign: segments("campaign", [["c1", "PF Baixada outubro", 3, 0.9], ["c2", "PME CNPJ ativo", 2, 1.25], ["c3", "Familiar Zona Oeste", 1.6, 1], ["c4", "Remarketing site", 0.8, 1.2]], total * 0.7, random),
      adset: segments("adset", [["s1", "Mulheres 30 a 45 RJ", 2.2, 1], ["s2", "Empresários Baixada", 1.5, 1.3], ["s3", "Lookalike clientes", 1.4, 1.1], ["s4", "Aberto Rio", 1.8, 0.8]], total * 0.7, random),
      ad: segments("ad", [["a1", "Vídeo família no parque", 2.4, 1], ["a2", "Carrossel operadoras", 1.8, 1.05], ["a3", "Depoimento cliente PME", 1.2, 1.3], ["a4", "Estático preço a partir de", 1.9, 0.75]], total * 0.7, random),
      form: segments("form", [["f1", "Cotação rápida PF", 3, 0.9], ["f2", "Cotação PME com CNPJ", 1.7, 1.25], ["f3", "Formulário longo família", 1, 1.15]], total * 0.55, random),
      queue: segments("queue", QUEUES.map((queue) => [queue.id ?? "__none", queue.name, queue.weight, queue.id === "q-indicacao" ? 1.5 : 1] as [string, string, number, number]), total, random),
      broker: segments("broker", BROKERS.filter((broker) => unitId === "all" || broker.unit === unitId).slice(0, 8).map((broker, index) => [broker.id, broker.name, 1.4 - index * 0.1, 1 + (index % 3) * 0.1] as [string, string, number, number]), total * 0.3, random),
      lead_type: segments("lead_type", [["pf", "Pessoa física", 5, 1], ["familia", "Família", 2.6, 1.1], ["pme", "PME", 1.9, 1.2], ["adesao", "Adesão", 0.7, 0.9]], total, random),
      plan_type: segments("plan_type", [["individual", "Individual", 4, 0.95], ["familiar", "Familiar", 3, 1.1], ["empresarial", "Empresarial", 2, 1.2]], total * 0.8, random),
      city: segments("city", [["ni", "Nova Iguaçu", 3.2, 1], ["rio", "Rio de Janeiro", 3, 1.05], ["dc", "Duque de Caxias", 1.6, 0.95], ["sj", "São João de Meriti", 1, 0.9], ["nil", "Nilópolis", 0.7, 1]], total * 0.85, random),
      age_band: segments("age_band", [["0-18", "Até 18 anos", 0.8, 1], ["19-33", "19 a 33 anos", 2.6, 0.9], ["34-48", "34 a 48 anos", 3.1, 1.1], ["49-58", "49 a 58 anos", 1.6, 1.05], ["59+", "59 anos ou mais", 0.9, 0.8]], total * 0.75, random),
      hour: segments("hour", hourEntries, total, random),
      origin: segments("origin", [["form", "Formulário", 6.2, 0.95], ["whatsapp", "WhatsApp", 3, 1.12], ["other", "Outros", 0.8, 1.05]], total, random),
      shift: [segmentRow("shift", "1", "Turno 1", round(total * 0.62), 1, random), segmentRow("shift", "2", "Turno 2", round(total * 0.38), 1, random)],
      origin_shift: segments("origin_shift", [["form:1", "Formulário, Turno 1", 3.9], ["whatsapp:1", "WhatsApp, Turno 1", 1.8], ["other:1", "Outros, Turno 1", 0.5], ["form:2", "Formulário, Turno 2", 2.3], ["whatsapp:2", "WhatsApp, Turno 2", 1.2], ["other:2", "Outros, Turno 2", 0.3]], total, random),
    },
    focus: null,
    focusedLeads: [],
    focusedLeadCount: 0,
  };
  return report;
}

/** The leads behind one segment (what the old page showed as "Leads deste recorte"). */
export function focusLeads(segment: LeadQualitySegment, unitId: UnitId, now: Date): LeadQualityReport["focusedLeads"] {
  const brokers = BROKERS.filter((broker) => unitId === "all" || broker.unit === unitId);
  const temperatures = ["hot", "warm", "warm", "cold", "cold", "cold", "unclassified"];
  const statuses = ["in_contact", "quote_sent", "distributed", "converted", "lost", "negotiation"];
  return Array.from({ length: Math.min(segment.total, 10) }, (_, index) => ({
    id: `${segment.key}-${index}`,
    name: LEAD_NAMES[(index * 3 + segment.key.length) % LEAD_NAMES.length],
    status: statuses[index % statuses.length],
    qualificationStatus: temperatures[index % temperatures.length],
    createdAt: ago(now, 40 + index * 170),
    queueName: QUEUES[index % 5].name,
    brokerName: index % 5 === 2 ? null : brokers[(index * 7) % brokers.length]?.name ?? null,
  }));
}

export function buildSimpleQuality(period: QualityPeriod, unitId: UnitId, queueId: string | null, now: Date): SimpleLeadQualityReportData {
  const unit = unitOf(unitId);
  const queueShare = queueId ? QUEUES.find((queue) => queue.id === queueId)?.weight ?? 1 : 1;
  const total = round(QUALITY_TOTAL[String(period)] * unit.share * queueShare);
  const good = round(total * 0.38);
  const cold = round(total * 0.33);
  const noReply = round(total * 0.17);
  const other = Math.max(0, total - good - cold - noReply);
  const dGood = round(good * 0.93);
  const dCold = round(cold * 0.71);
  const dNoReply = round(noReply * 0.52);
  const brokers = round(52 * unit.share);
  const timeline = period === "today";
  const hoursList = timeline ? [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] : Array.from({ length: 24 }, (_, hour) => hour);
  const weight = (hour: number) => (hour >= 8 && hour <= 22 ? 1 + Math.sin(((hour - 8) / 14) * Math.PI) * 1.4 : 0.3);
  const weightSum = hoursList.reduce((sum, hour) => sum + weight(hour), 0);
  let waiting = 0;
  const ranOutAt = timeline ? 11 : null;
  const hours = hoursList.map((hour, index) => {
    const w = weight(hour) / weightSum;
    const arrivedGood = round(good * w);
    const arrivedWeak = round((cold + noReply) * w);
    const late = ranOutAt !== null && hour >= ranOutAt && hour < 19;
    const distributedGood = late ? arrivedGood : round(dGood * w);
    const distributedWeak = late ? round(arrivedWeak * 0.9) : round((dCold + dNoReply) * w * 0.6);
    waiting = Math.max(0, waiting + arrivedGood - distributedGood + (late ? -waiting : 1));
    const startsAt = new Date(now.getTime() - (hoursList.length - index) * 3_600_000).toISOString();
    return {
      label: `${String(hour).padStart(2, "0")}h`,
      startsAt,
      arrived: { good: arrivedGood, cold: round(arrivedWeak * 0.66), noReply: arrivedWeak - round(arrivedWeak * 0.66), other: round(other * w) },
      distributed: { good: distributedGood, cold: round(distributedWeak * 0.66), noReply: distributedWeak - round(distributedWeak * 0.66), other: 0 },
      goodWaiting: timeline ? (late ? 0 : waiting) : null,
    };
  });
  const byQueue = QUEUES.filter((queue) => !queueId || queue.id === queueId).map((queue, index) => {
    const arrived = round(total * (queueId ? 1 : queue.weight));
    const queueGood = round(arrived * (0.32 + index * 0.04));
    return {
      queueId: queue.id,
      queue: queue.name,
      holdColdLeads: queue.id === "q-meta-pme" || queue.id === "q-indicacao",
      arrived,
      good: queueGood,
      weak: round(arrived * 0.48),
      distributed: round(arrived * 0.82),
      distributedWeak: round(arrived * 0.3),
      goodRanOut: timeline && index === 0 ? "11h" : timeline && index === 2 ? "12h" : null,
      weakWhileGoodWaiting: index === 1 ? round(arrived * 0.04) : 0,
    };
  }).filter((queue) => queue.arrived > 0);
  const distributedTotal = dGood + dCold + dNoReply;
  const withoutDistributed = dGood;
  return {
    period,
    window: { since: new Date(now.getTime() - (period === "today" ? 1 : period) * 86_400_000).toISOString(), until: null },
    filters: { queueId, origin: null },
    truncated: period === 90,
    arrived: { good, cold, noReply, other, total },
    distributed: { good: dGood, cold: dCold, noReply: dNoReply, other: 0, total: distributedTotal },
    brokers,
    converted: { good: round(good * 0.07), weak: round((cold + noReply) * 0.012) },
    byQueue,
    hours,
    hourly: timeline ? "timeline" : "hour_of_day",
    goodRanOut: timeline ? { label: "11h" } : null,
    shifts: [
      { key: 1, label: "Turno 1 (19h às 13h30)", distributedGood: round(dGood * 0.62), distributedWeak: round((dCold + dNoReply) * 0.58), brokers: round(brokers * 0.8) },
      { key: 2, label: "Turno 2 (13h30 às 19h)", distributedGood: round(dGood * 0.38), distributedWeak: round((dCold + dNoReply) * 0.42), brokers: round(brokers * 0.55) },
    ],
    withoutWeak: {
      distributed: withoutDistributed,
      removed: distributedTotal - withoutDistributed,
      removedShare: distributedTotal ? Math.round(((distributedTotal - withoutDistributed) / distributedTotal) * 1000) / 10 : 0,
      perBrokerNow: brokers ? Math.round((distributedTotal / brokers) * 10) / 10 : null,
      perBrokerWithout: brokers ? Math.round((withoutDistributed / brokers) * 10) / 10 : null,
    },
  };
}
