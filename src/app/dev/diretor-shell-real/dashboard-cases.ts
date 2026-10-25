/**
 * Casos de borda do painel do diretor na moldura real (dev): `?aba=operacao|qualidade|funil&caso=uma-hora|zerado|cheio|uma-fila`.
 * Os números saem das mesmas contas puras do servidor (resumo do painel e relatório simples de qualidade), com linhas
 * sintéticas e determinísticas. Nada aqui chega à produção.
 */
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import { summarizeDuties, summarizeQueues, summarizeWhatsApp } from "@/features/dashboard/essential/essential-summary";
import { businessTurnStart, windowLabel } from "@/features/dashboard/essential/business-window";
import type { QualificationFunnel } from "@/features/qualification-turbo/funnel";
import { operationDayStart } from "@/features/reports/metrics/lead-quality-period";
import type { SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";
import { buildSimpleQualityReport, type SimpleLeadClass, type SimpleLeadRow } from "@/features/reports/metrics/lead-quality-simple";

import { buildFunnel } from "@/app/dev/diretor-dashboard-preview/_components/data";
import { emptyEssential } from "@/app/dev/diretor-dashboard-preview/_components/essential-example";

export type DashboardCase = "uma-hora" | "zerado" | "cheio" | "uma-fila";
export const DASHBOARD_CASES: DashboardCase[] = ["uma-hora", "zerado", "cheio", "uma-fila"];

/** "Hoje às 20h42" (início do dia da operação) e "hoje às 13h42" (dia cheio, desde as 19h de ontem). */
export const CASE_NOW: Record<DashboardCase, Date> = {
  "uma-hora": new Date("2026-10-24T23:42:00.000Z"),
  zerado: new Date("2026-10-24T23:42:00.000Z"),
  cheio: new Date("2026-10-24T16:42:00.000Z"),
  "uma-fila": new Date("2026-10-24T16:42:00.000Z"),
};

const QUEUES = [
  { id: "q-tatiana", name: "Fila Tatiana", hue: 210, weight: 0.42 },
  { id: "q-pf", name: "PF Renan", hue: 30, weight: 0.27 },
  { id: "q-pme", name: "Meta PME", hue: 140, weight: 0.19 },
  { id: "q-indicacao", name: "Indicação", hue: 280, weight: 0.12 },
];

/** Gerador determinístico (mulberry32): o mesmo print em toda execução. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickClass(value: number): SimpleLeadClass {
  if (value < 0.38) return "good";
  if (value < 0.71) return "cold";
  if (value < 0.88) return "no_reply";
  return "other";
}

/** Linhas de leads do dia da operação até `now`, com a hora em que os bons acabam (só frios para entregar). */
function qualityRows(kase: DashboardCase, now: Date): SimpleLeadRow[] {
  const since = operationDayStart(now).getTime();
  if (kase === "zerado") return [];
  if (kase === "uma-hora") {
    // Produção às 20h: poucos leads em 19h e 20h, nenhum distribuído ainda (o print que motivou a revisão).
    const at = (minutes: number) => new Date(since + minutes * 60_000);
    const row = (minutes: number, quality: SimpleLeadClass): SimpleLeadRow => ({ createdAt: at(minutes), assignedAt: null, quality, queueId: "q-tatiana", queueName: "Fila Tatiana", brokerId: null, converted: false });
    return [row(22, "good"), row(48, "cold"), row(64, "good"), row(71, "no_reply"), row(80, "good"), row(88, "no_reply"), row(95, "other")];
  }
  const random = seeded(kase === "cheio" ? 12345 : 7);
  const total = kase === "cheio" ? 12_345 : 214;
  const queues = kase === "uma-fila" ? [QUEUES[0]] : QUEUES;
  const span = now.getTime() - since;
  const ranOutAt = since + span * 0.62;
  const rows: SimpleLeadRow[] = [];
  for (let index = 0; index < total; index += 1) {
    // Mais leads de dia que de madrugada.
    let offset = random() * span;
    if (random() < 0.55) offset = span * (0.45 + random() * 0.55);
    const createdAt = new Date(since + offset);
    const quality = pickClass(random());
    const pick = random();
    let cumulative = 0;
    const queue = queues.find((item) => (cumulative += item.weight / queues.reduce((sum, q) => sum + q.weight, 0)) >= pick) ?? queues[0];
    const late = createdAt.getTime() >= ranOutAt;
    const sends = quality === "good" ? true : quality === "other" ? false : random() < (late ? 0.9 : 0.55);
    const delay = quality === "good" ? (late ? 0 : 20 + random() * 60) : late ? 1 : 20 + random() * 120;
    const assigned = sends ? new Date(Math.min(now.getTime() - 60_000, createdAt.getTime() + delay * 60_000)) : null;
    const brokers = kase === "uma-fila" ? 0 : 52;
    rows.push({
      createdAt,
      assignedAt: assigned && brokers ? assigned : null,
      quality,
      queueId: queue.id,
      queueName: queue.name,
      holdColdLeads: queue.id === "q-pme",
      brokerId: assigned && brokers ? `broker-${Math.floor(random() * brokers)}` : null,
      converted: random() < (quality === "good" ? 0.06 : 0.01),
    });
  }
  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

const qualityCache = new Map<DashboardCase, SimpleLeadQualityReportData>();

/** Guardado por caso: o dia cheio (12.345 linhas) leva alguns segundos na conta pura. */
export function qualityCase(kase: DashboardCase): SimpleLeadQualityReportData {
  const cached = qualityCache.get(kase);
  if (cached) return cached;
  const now = CASE_NOW[kase];
  const since = operationDayStart(now);
  const report = buildSimpleQualityReport(qualityRows(kase, now), { since, until: null }, now);
  const data: SimpleLeadQualityReportData = { period: "today", window: { since: since.toISOString(), until: null }, filters: { queueId: null, origin: null }, truncated: false, ...report };
  qualityCache.set(kase, data);
  return data;
}

/** Funil de exemplo reescalado para `arrived` leads (0 = dia zerado). */
function scaleFunnel(base: QualificationFunnel, arrived: number): QualificationFunnel {
  const first = base.stages[0]?.count || 1;
  const k = arrived / first;
  const r = (value: number) => Math.round(value * k);
  const money = (value: number) => Math.round(value * k * 100) / 100;
  const qualified = r(base.stages.find((stage) => stage.key === "qualified")?.count ?? 0);
  const cost = base.cost ? { ...base.cost, total: money(base.cost.total), marketing: money(base.cost.marketing), utility: money(base.cost.utility), templatesDelivered: r(base.cost.templatesDelivered) } : null;
  return {
    ...base,
    stages: base.stages.map((stage) => ({ ...stage, count: r(stage.count) })),
    medianMinutesToReply: arrived ? base.medianMinutesToReply : null,
    now: base.now.map((row) => ({ ...row, count: r(row.count) })),
    lossReasons: base.lossReasons.map((row) => ({ ...row, count: r(row.count) })).filter((row) => row.count > 0),
    variants: base.variants.map((row) => {
      const sent = r(row.sent);
      const replied = r(row.replied);
      const rate = sent ? replied / sent : 0;
      const margin = sent ? 1.96 * Math.sqrt((rate * (1 - rate)) / sent) : 0;
      return { ...row, sent, replied, qualified: r(row.qualified), rate, low: Math.max(0, rate - margin), high: Math.min(1, rate + margin) };
    }).filter((row) => row.sent > 0),
    touches: base.touches.map((row) => ({ ...row, sent: r(row.sent), repliesAfter: r(row.repliesAfter) })),
    cost: cost ? { ...cost, perQualified: qualified ? Math.round((cost.total / qualified) * 100) / 100 : null } : null,
  };
}

export function funnelCase(kase: DashboardCase): QualificationFunnel {
  const now = CASE_NOW[kase];
  const base = buildFunnel("today", "all", now);
  const arrived: Record<DashboardCase, number> = { "uma-hora": 7, zerado: 0, cheio: 12_345, "uma-fila": 214 };
  return scaleFunnel(base, arrived[kase]);
}

export function essentialCase(kase: DashboardCase): EssentialDashboard {
  const now = CASE_NOW[kase];
  if (kase === "zerado") return emptyEssential(now);
  const since = businessTurnStart(now, 0);
  const label = windowLabel(since);
  const queueRows = kase === "cheio"
    ? QUEUES.flatMap((queue) => {
      const total = Math.round(12_345 * queue.weight);
      const hot = Math.round(total * 0.16);
      const warm = Math.round(total * 0.22);
      const cold = Math.round(total * 0.47);
      return [
        { queueId: queue.id, queueName: queue.name, hue: queue.hue, status: "hot", leads: hot },
        { queueId: queue.id, queueName: queue.name, hue: queue.hue, status: "warm", leads: warm },
        { queueId: queue.id, queueName: queue.name, hue: queue.hue, status: "cold", leads: cold },
        { queueId: queue.id, queueName: queue.name, hue: queue.hue, status: "pending", leads: total - hot - warm - cold },
      ];
    })
    : [
      { queueId: "q-tatiana", queueName: "Fila Tatiana", hue: 210, status: "hot", leads: kase === "uma-hora" ? 1 : 31 },
      { queueId: "q-tatiana", queueName: "Fila Tatiana", hue: 210, status: "warm", leads: kase === "uma-hora" ? 2 : 52 },
      { queueId: "q-tatiana", queueName: "Fila Tatiana", hue: 210, status: "cold", leads: kase === "uma-hora" ? 3 : 96 },
      { queueId: "q-tatiana", queueName: "Fila Tatiana", hue: 210, status: "pending", leads: kase === "uma-hora" ? 1 : 35 },
    ];
  const coldAttempts = kase === "cheio"
    ? Array.from({ length: 4_210 }, (_, index) => ({ queueId: QUEUES[index % QUEUES.length].id, attempts: index % 4 }))
    : [{ queueId: "q-tatiana", attempts: 1 }, { queueId: "q-tatiana", attempts: 0 }];
  const queues = summarizeQueues(queueRows as Parameters<typeof summarizeQueues>[0], [], coldAttempts);

  const duties = kase === "cheio"
    ? [
      { scheduleId: "pme", name: "Plantão PME", startsAt: "08:00", endsAt: "19:00", queueId: "q-tatiana", minimumBrokers: 12, brokerCount: 14 },
      { scheduleId: "pf", name: "Plantão PF Renan", startsAt: "09:00", endsAt: "18:00", queueId: "q-pf", minimumBrokers: 10, brokerCount: 12 },
      { scheduleId: "meta", name: "Plantão Meta PME", startsAt: "08:00", endsAt: "20:00", queueId: "q-pme", minimumBrokers: 8, brokerCount: 9 },
      { scheduleId: "indicacao", name: "Plantão Indicação e parcerias da Zona Oeste", startsAt: "10:00", endsAt: "19:00", queueId: "q-indicacao", minimumBrokers: 6, brokerCount: 6 },
    ]
    : [{ scheduleId: "noite", name: "Plantão da noite", startsAt: "19:00", endsAt: "07:00", queueId: "q-tatiana", minimumBrokers: 2, brokerCount: kase === "uma-fila" ? 0 : 3 }];
  const running = summarizeDuties(
    duties,
    new Map(kase === "cheio" ? [["q-tatiana", 1_204], ["q-pf", 386], ["q-pme", 97], ["q-indicacao", 12]] : [["q-tatiana", kase === "uma-hora" ? 4 : 18]]),
    new Map(kase === "cheio" ? [["pme", 3_412], ["pf", 2_105], ["meta", 1_480], ["indicacao", 640]] : [["noite", kase === "uma-hora" ? 0 : 61]]),
    new Map(kase === "cheio" ? [["pme", 13], ["pf", 9], ["meta", 8], ["indicacao", 6]] : [["noite", kase === "uma-fila" ? 0 : 2]]),
  );

  const brokerNames = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Reis", "Elisa Melo", "Fábio Nunes", "Gabriela Rocha", "Heitor Campos", "Íris Teixeira", "João Pedro Albuquerque de Souza", "Karina Lopes", "Lucas Prado"];
  const whatsapp = summarizeWhatsApp(
    kase === "uma-fila"
      ? []
      : kase === "uma-hora"
        ? brokerNames.slice(0, 5).map((name, index) => ({ id: `b${index}`, name, connected: index < 2, received: 0, responding: 0, active: 0 }))
        : brokerNames.map((name, index) => ({ id: `b${index}`, name, connected: index < 10, received: 1_234 - index * 61, responding: 512 - index * 23, active: 148 - index * 9 })),
  );

  return {
    generatedAt: now.toISOString(),
    firstName: "Alex",
    duties: { running, next: null },
    queues: { since: since.toISOString(), label, rows: queues.queues, totals: queues.totals },
    whatsapp: { ...whatsapp, since: since.toISOString(), label },
  };
}
