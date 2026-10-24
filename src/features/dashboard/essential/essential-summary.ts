/**
 * Contas do painel essencial do diretor. Puras: recebem linhas já agrupadas pelo banco
 * (sem N+1) e devolvem os números que a tela mostra, com a mesma regra em todos os blocos.
 */

export type QueueLeadRow = { queueId: string | null; queueName: string | null; hue: number | null; status: string | null; leads: number };
export type QueueWaitingRow = { queueId: string | null; waiting: number; distributed: number };
export type ColdLeadRow = { queueId: string | null; attempts: number };

export type Requalification = { coldLeads: number; attempts: number; once: number; twice: number; threePlus: number };

export type EssentialQueue = {
  id: string | null;
  name: string;
  hue: number | null;
  arrived: number;
  hot: number;
  warm: number;
  cold: number;
  inQualification: number;
  /** Quentes e mornos: os leads que a operação pode trabalhar agora. */
  qualified: number;
  waiting: number;
  requalification: Requalification;
};

const emptyRequalification = (): Requalification => ({ coldLeads: 0, attempts: 0, once: 0, twice: 0, threePlus: 0 });

/** Fila por fila: entraram, temperatura, em qualificação (o que sobra) e requalificação dos frios. */
export function summarizeQueues(leads: QueueLeadRow[], waiting: QueueWaitingRow[], coldLeads: ColdLeadRow[]): { queues: EssentialQueue[]; totals: Omit<EssentialQueue, "id" | "name" | "hue"> } {
  const byQueue = new Map<string, EssentialQueue>();
  const entry = (queueId: string | null, name: string | null, hue: number | null) => {
    const key = queueId ?? "__none";
    const current = byQueue.get(key) ?? {
      id: queueId, name: name ?? "Sem fila", hue, arrived: 0, hot: 0, warm: 0, cold: 0, inQualification: 0, qualified: 0, waiting: 0,
      requalification: emptyRequalification(),
    };
    byQueue.set(key, current);
    return current;
  };

  for (const row of leads) {
    const queue = entry(row.queueId, row.queueName, row.hue);
    queue.arrived += row.leads;
    if (row.status === "hot") queue.hot += row.leads;
    else if (row.status === "warm") queue.warm += row.leads;
    else if (row.status === "cold") queue.cold += row.leads;
    else queue.inQualification += row.leads;
  }
  for (const row of waiting) {
    entry(row.queueId, null, null).waiting += row.waiting;
  }
  for (const lead of coldLeads) {
    const { requalification } = entry(lead.queueId, null, null);
    requalification.coldLeads += 1;
    requalification.attempts += lead.attempts;
    if (lead.attempts === 1) requalification.once += 1;
    else if (lead.attempts === 2) requalification.twice += 1;
    else if (lead.attempts >= 3) requalification.threePlus += 1;
  }

  const queues = [...byQueue.values()]
    .map((queue) => ({ ...queue, qualified: queue.hot + queue.warm }))
    .sort((a, b) => b.arrived - a.arrived || b.waiting - a.waiting || a.name.localeCompare(b.name, "pt-BR"));

  const totals = queues.reduce<Omit<EssentialQueue, "id" | "name" | "hue">>((sum, queue) => ({
    arrived: sum.arrived + queue.arrived,
    hot: sum.hot + queue.hot,
    warm: sum.warm + queue.warm,
    cold: sum.cold + queue.cold,
    inQualification: sum.inQualification + queue.inQualification,
    qualified: sum.qualified + queue.qualified,
    waiting: sum.waiting + queue.waiting,
    requalification: {
      coldLeads: sum.requalification.coldLeads + queue.requalification.coldLeads,
      attempts: sum.requalification.attempts + queue.requalification.attempts,
      once: sum.requalification.once + queue.requalification.once,
      twice: sum.requalification.twice + queue.requalification.twice,
      threePlus: sum.requalification.threePlus + queue.requalification.threePlus,
    },
  }), {
    arrived: 0, hot: 0, warm: 0, cold: 0, inQualification: 0, qualified: 0, waiting: 0,
    requalification: emptyRequalification(),
  });

  return { queues, totals };
}

export type DutyInput = { scheduleId: string; name: string; startsAt: string; endsAt: string; queueId: string | null; minimumBrokers: number };
export type EssentialDuty = DutyInput & {
  /** Leads esperando distribuição na fila do plantão. */
  available: number;
  /** Leads distribuídos hoje na fila do plantão. */
  distributed: number;
  /** Corretores com presença confirmada no plantão de hoje. */
  activeBrokers: number;
  belowMinimum: boolean;
};

/** Plantões ativos agora, com o número de cada um. Sem fila ligada, os leads ficam em zero. */
export function summarizeDuties(duties: DutyInput[], waiting: QueueWaitingRow[], confirmedBySchedule: Map<string, number>): EssentialDuty[] {
  const waitingByQueue = new Map(waiting.map((row) => [row.queueId, row]));
  return duties.map((duty) => {
    const queue = duty.queueId ? waitingByQueue.get(duty.queueId) : undefined;
    const activeBrokers = confirmedBySchedule.get(duty.scheduleId) ?? 0;
    return {
      ...duty,
      available: queue?.waiting ?? 0,
      distributed: queue?.distributed ?? 0,
      activeBrokers,
      belowMinimum: activeBrokers < duty.minimumBrokers,
    };
  });
}

export type BrokerWhatsAppRow = { id: string; name: string; connected: boolean; received: number; responding: number; active: number };
export type EssentialWhatsApp = {
  total: number;
  connected: number;
  received: number;
  responding: number;
  active: number;
  /** Percentual de respostas sobre os recebidos dos conectados; 0 quando não há recebidos. */
  responseRate: number;
  brokers: BrokerWhatsAppRow[];
};

/** Corretores conectados x leads recebidos na janela x respondendo; atendimentos ativos agora. */
export function summarizeWhatsApp(rows: BrokerWhatsAppRow[]): EssentialWhatsApp {
  const connectedRows = rows.filter((row) => row.connected);
  const received = connectedRows.reduce((sum, row) => sum + row.received, 0);
  const responding = connectedRows.reduce((sum, row) => sum + row.responding, 0);
  const active = connectedRows.reduce((sum, row) => sum + row.active, 0);
  const brokers = [...connectedRows].sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, "pt-BR"));
  return {
    total: rows.length,
    connected: connectedRows.length,
    received,
    responding,
    active,
    responseRate: received ? Math.round((responding / received) * 100) : 0,
    brokers,
  };
}
