/** Dados de exemplo do painel essencial para a prévia e os testes. Usa as mesmas contas puras do servidor. */
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import { summarizeDuties, summarizeQueues, summarizeWhatsApp } from "@/features/dashboard/essential/essential-summary";
import { businessDaysBack, businessTurnStart, windowLabel } from "@/features/dashboard/essential/business-window";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";
import { toHours } from "@/features/dashboard/essential/pulse-core";

const PERIOD_DAYS: Record<OverviewPeriod, number> = { today: 1, "7d": 7, "30d": 30 };

/** Multiplica os números de exemplo para o período: 7 e 30 dias têm mais leads, o "agora" não muda. */
const SCALE: Record<OverviewPeriod, number> = { today: 1, "7d": 5, "30d": 16 };

export function buildEssential(period: OverviewPeriod, unit: string, now: Date): EssentialDashboard {
  const scale = SCALE[period];
  const unitFactor = unit === "all" ? 1 : 0.6;
  const k = (value: number) => Math.round(value * scale * unitFactor);
  const queueSince = businessTurnStart(now, businessDaysBack(PERIOD_DAYS[period]));
  const whatsappSince = businessTurnStart(now, 0);

  const queues = summarizeQueues(
    [
      { queueId: "tatiana", queueName: "Fila Tatiana", hue: 210, status: "hot", leads: k(9) },
      { queueId: "tatiana", queueName: "Fila Tatiana", hue: 210, status: "warm", leads: k(6) },
      { queueId: "tatiana", queueName: "Fila Tatiana", hue: 210, status: "cold", leads: k(7) },
      { queueId: "tatiana", queueName: "Fila Tatiana", hue: 210, status: "pending", leads: k(4) },
      { queueId: "pf", queueName: "PF Renan", hue: 30, status: "hot", leads: k(3) },
      { queueId: "pf", queueName: "PF Renan", hue: 30, status: "warm", leads: k(2) },
      { queueId: "pf", queueName: "PF Renan", hue: 30, status: "cold", leads: k(5) },
    ],
    [],
    [
      { queueId: "tatiana", attempts: 1 },
      { queueId: "tatiana", attempts: 1 },
      { queueId: "tatiana", attempts: 2 },
      { queueId: "tatiana", attempts: 3 },
      { queueId: "pf", attempts: 0 },
      { queueId: "pf", attempts: 1 },
    ],
  );

  const running = summarizeDuties(
    [
      { scheduleId: "pme", name: "Plantão PME", startsAt: "08:00", endsAt: "19:00", queueId: "tatiana", minimumBrokers: 3, brokerCount: 3 },
      { scheduleId: "presencial", name: "Plantão Presencial", startsAt: "09:00", endsAt: "18:00", queueId: "pf", minimumBrokers: 2, brokerCount: 3 },
    ],
    new Map([["tatiana", 6], ["pf", 0]]),
    new Map([["pme", 9], ["presencial", 4]]),
    new Map([["pme", 2], ["presencial", 3]]),
  );

  const whatsapp = summarizeWhatsApp([
    { id: "ana", name: "Ana Souza", connected: true, received: 14, responding: 6, active: 4 },
    { id: "bruno", name: "Bruno Lima", connected: true, received: 12, responding: 3, active: 1 },
    { id: "carla", name: "Carla Dias", connected: true, received: 9, responding: 4, active: 3 },
    { id: "diego", name: "Diego Reis", connected: false, received: 0, responding: 0, active: 0 },
    { id: "elisa", name: "Elisa Melo", connected: false, received: 0, responding: 0, active: 0 },
  ]);

  return {
    generatedAt: now.toISOString(),
    firstName: "Renata",
    duties: { running, next: null },
    queues: { since: queueSince.toISOString(), label: windowLabel(queueSince), rows: queues.queues, totals: queues.totals },
    whatsapp: { ...whatsapp, since: whatsappSince.toISOString(), label: windowLabel(whatsappSince) },
    pulse: {
      arrived: [2, 3, 5, 8, 6, 9, 11, 7, 10, 12, 9, 6].map(k),
      qualified: [1, 2, 3, 5, 4, 6, 7, 4, 6, 8, 5, 4].map(k),
      distributed: [1, 2, 4, 6, 5, 7, 9, 5, 8, 9, 7, 5].map(k),
      sales: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0].map(k),
      distributedTotal: k(68),
      avgAssignMinutes: 4,
      salesTotal: k(4),
      salesValue: 3980 * scale * unitFactor,
      previousArrived: k(29),
      hours: toHours([[6, 1, 0], [7, 0, 0], [8, 3, 1], [9, 6, 2], [10, 9, 3], [11, 11, 4], [12, 8, 3], [13, 7, 2], [14, 10, 3], [15, 12, 4], [16, 9, 2], [17, 6, 2], [18, 4, 1], [19, 2, 1]]
        .flatMap(([hour, whatsappCount, formCount]) => [
          { hour, channel: "whatsapp", total: k(whatsappCount) },
          { hour, channel: "form", total: k(formCount) },
        ])),
    },
  };
}

/** Empresa sem movimento: nenhum plantão, nenhum lead na janela, nenhum corretor conectado. */
export function emptyEssential(now: Date): EssentialDashboard {
  const since = businessTurnStart(now, 0);
  const queues = summarizeQueues([], [], []);
  return {
    generatedAt: now.toISOString(),
    firstName: null,
    duties: { running: [], next: null },
    queues: { since: since.toISOString(), label: windowLabel(since), rows: queues.queues, totals: queues.totals },
    whatsapp: { ...summarizeWhatsApp([]), since: since.toISOString(), label: windowLabel(since) },
  };
}
