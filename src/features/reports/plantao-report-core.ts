

export const PLANTAO_REPORT_HOUR = 19;
export const PLANTAO_REPORT_GROUP_DEFAULT = "Fechamento Plantão Geral";
export const PLANTAO_REPORT_WAHA_NUMBER_ID = "003a8720-68a0-4b58-88a2-06cb35470f2d";

export type PlantaoReportConfig = {
  enabled: boolean;
  wahaNumberId: string;
  groupName: string;
  /** WAHA group id without the `@g.us` suffix. */
  groupId: string | null;
  hour: number;
  queues: {
    tatiana: string;
    facebook: string[];
    whatsappInternal: string;
    indicationsExcludedQueue: string;
  };
  duties: {
    pmePrefix: string;
    premiumName: string;
    presencialPrefix: string;
    indicationsExcludedPrefix: string;
  };
};

export const DEFAULT_PLANTAO_REPORT_CONFIG: PlantaoReportConfig = {
  enabled: false,
  wahaNumberId: PLANTAO_REPORT_WAHA_NUMBER_ID,
  groupName: PLANTAO_REPORT_GROUP_DEFAULT,
  groupId: null,
  hour: PLANTAO_REPORT_HOUR,
  queues: {
    tatiana: "Fila TATIANA",
    facebook: ["Fila PF - Renan", "Fila PME - Renan"],
    whatsappInternal: "Whatsapp Renan",
    indicationsExcludedQueue: "Alessandra Leads",
  },
  duties: {
    pmePrefix: "PME",
    premiumName: "Premium",
    presencialPrefix: "Presencial",
    indicationsExcludedPrefix: "Plantão Plus",
  },
};

export type PlantaoQueueRow = {
  queueName: string | null;
  kind: "form" | "whatsapp" | "other";
  count: number;
};

export type PlantaoOfferRow = {
  leadId: string;
  brokerId: string;
  dutyScheduleId: string | null;
  dutyName: string | null;
  originalQueueName: string | null;
  offeredAt: Date | string;
};

export type PlantaoLine = { name: string; count: number };

export type PlantaoReportMetrics = {
  /** Total gerado: todos os leads do dia relatado, pela fila de entrada (mesmo critério da tela de Qualidade). */
  generated: { total: number };
  /** EXTERNO = Fila Tatiana. `details` (WhatsApp e RD) só existe quando somam exatamente o total da fila. */
  external: { total: number; details: { whatsapp: number; rd: number } | null };
  /** INTERNO = PF, PME e Whatsapp Renan, com o detalhe de cada fila. */
  internal: { total: number; queues: PlantaoLine[] };
  /** Outras filas: Venâncio, Alessandra e qualquer fila fora das categorias. */
  others: { total: number; queues: PlantaoLine[] };
  indications: { morning: number; afternoon: number };
  quantity: { pme: number; onlineMorning: number; onlineAfternoon: number; inPersonMorning: number; inPersonAfternoon: number };
};

export function normalizePlantaoLabel(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** Exact normalized group name match; it never chooses a partial or similarly named group. */
export function findPlantaoReportGroupId(chats: unknown[], groupName: string): string | null {
  const expected = normalizePlantaoLabel(groupName);
  for (const chat of chats) {
    if (!chat || typeof chat !== "object") continue;
    const record = chat as Record<string, unknown>;
    const id = typeof record.id === "string"
      ? record.id
      : record.id && typeof record.id === "object"
        ? String((record.id as Record<string, unknown>)._serialized ?? "")
        : "";
    if (!id.endsWith("@g.us") || typeof record.name !== "string") continue;
    if (normalizePlantaoLabel(record.name) === expected) return id.slice(0, -"@g.us".length);
  }
  return null;
}

export function parsePlantaoReportConfig(value: string | null | undefined): PlantaoReportConfig {
  if (!value) return structuredClone(DEFAULT_PLANTAO_REPORT_CONFIG);
  try {
    const raw = JSON.parse(value) as Partial<PlantaoReportConfig>;
    const queues = raw.queues;
    const duties = raw.duties;
    const groupId = typeof raw.groupId === "string" && /^[\w.-]+$/.test(raw.groupId) ? raw.groupId : null;
    return {
      enabled: raw.enabled === true,
      wahaNumberId: typeof raw.wahaNumberId === "string" && raw.wahaNumberId.trim() ? raw.wahaNumberId.trim() : DEFAULT_PLANTAO_REPORT_CONFIG.wahaNumberId,
      groupName: typeof raw.groupName === "string" && raw.groupName.trim() ? raw.groupName.trim() : PLANTAO_REPORT_GROUP_DEFAULT,
      groupId,
      hour: Number.isInteger(raw.hour) && raw.hour! >= 0 && raw.hour! <= 23 ? raw.hour! : PLANTAO_REPORT_HOUR,
      queues: {
        tatiana: typeof queues?.tatiana === "string" && queues.tatiana.trim() ? queues.tatiana.trim() : DEFAULT_PLANTAO_REPORT_CONFIG.queues.tatiana,
        facebook: Array.isArray(queues?.facebook) ? queues.facebook.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [...DEFAULT_PLANTAO_REPORT_CONFIG.queues.facebook],
        whatsappInternal: typeof queues?.whatsappInternal === "string" && queues.whatsappInternal.trim() ? queues.whatsappInternal.trim() : DEFAULT_PLANTAO_REPORT_CONFIG.queues.whatsappInternal,
        indicationsExcludedQueue: typeof queues?.indicationsExcludedQueue === "string" && queues.indicationsExcludedQueue.trim() ? queues.indicationsExcludedQueue.trim() : DEFAULT_PLANTAO_REPORT_CONFIG.queues.indicationsExcludedQueue,
      },
      duties: {
        pmePrefix: typeof duties?.pmePrefix === "string" && duties.pmePrefix.trim() ? duties.pmePrefix.trim() : DEFAULT_PLANTAO_REPORT_CONFIG.duties.pmePrefix,
        premiumName: typeof duties?.premiumName === "string" && duties.premiumName.trim() ? duties.premiumName.trim() : DEFAULT_PLANTAO_REPORT_CONFIG.duties.premiumName,
        presencialPrefix: typeof duties?.presencialPrefix === "string" && duties.presencialPrefix.trim() ? duties.presencialPrefix.trim() : DEFAULT_PLANTAO_REPORT_CONFIG.duties.presencialPrefix,
        indicationsExcludedPrefix: typeof duties?.indicationsExcludedPrefix === "string" && duties.indicationsExcludedPrefix.trim() ? duties.indicationsExcludedPrefix.trim() : DEFAULT_PLANTAO_REPORT_CONFIG.duties.indicationsExcludedPrefix,
      },
    };
  } catch {
    return structuredClone(DEFAULT_PLANTAO_REPORT_CONFIG);
  }
}

export function classifyPlantaoLead(input: { hasFormAnswers: boolean; hasCtwaClid: boolean; hasWithoutReferral: boolean }): PlantaoQueueRow["kind"] {
  if (input.hasFormAnswers) return "form";
  if (input.hasCtwaClid || input.hasWithoutReferral) return "whatsapp";
  return "other";
}


function localHour(value: Date | string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date(value)));
}

function localMinute(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", minute: "2-digit" }).formatToParts(new Date(value));
  return Number(parts.find((part) => part.type === "minute")?.value ?? 0);
}

function isAfternoon(value: Date | string) {
  const hour = localHour(value);
  const minute = localMinute(value);
  return hour > 13 || (hour === 13 && minute >= 30);
}

type ScheduleBucket = { leads: Set<string>; brokers: Set<string> };

function averagesFor(rows: readonly PlantaoOfferRow[], predicate: (name: string, row: PlantaoOfferRow) => boolean, period: "morning" | "afternoon" | "all") {
  const totals: ScheduleBucket = { leads: new Set<string>(), brokers: new Set<string>() };
  for (const row of rows) {
    if (!row.dutyScheduleId || !row.dutyName) continue;
    const normalized = normalizePlantaoLabel(row.dutyName);
    if (!predicate(normalized, row)) continue;
    if (period === "morning" && isAfternoon(row.offeredAt)) continue;
    if (period === "afternoon" && !isAfternoon(row.offeredAt)) continue;
    totals.leads.add(row.leadId);
    totals.brokers.add(row.brokerId);
  }
  return totals.brokers.size ? totals.leads.size / totals.brokers.size : 0;
}

export function calculatePlantaoMetrics(rows: readonly PlantaoQueueRow[], offers: readonly PlantaoOfferRow[], config: PlantaoReportConfig): PlantaoReportMetrics {
  const sumFor = (name: string, kind?: PlantaoQueueRow["kind"]) => {
    const key = normalizePlantaoLabel(name);
    return rows.filter((row) => row.queueName && normalizePlantaoLabel(row.queueName) === key && (!kind || row.kind === kind)).reduce((total, row) => total + row.count, 0);
  };
  const generatedTotal = rows.reduce((total, row) => total + row.count, 0);

  // EXTERNO: a Fila Tatiana inteira, como na tela de Qualidade. O detalhe WhatsApp/RD só entra se fechar a soma.
  const externalTotal = sumFor(config.queues.tatiana);
  const whatsapp = sumFor(config.queues.tatiana, "whatsapp");
  const rd = sumFor(config.queues.tatiana, "form");
  const details = whatsapp + rd === externalTotal ? { whatsapp, rd } : null;

  // INTERNO: PF, PME e Whatsapp Renan.
  const internalNames = [...config.queues.facebook, config.queues.whatsappInternal];
  const internalQueues = internalNames.map((name) => ({ name, count: sumFor(name) }));
  const internalTotal = internalQueues.reduce((total, line) => total + line.count, 0);

  // OUTRAS FILAS: qualquer nome fora das categorias (inclui quem não tem fila).
  const categoryKeys = new Set([config.queues.tatiana, ...internalNames].map(normalizePlantaoLabel));
  const otherByName = new Map<string, number>();
  for (const row of rows) {
    const name = row.queueName ?? "Sem fila";
    if (categoryKeys.has(normalizePlantaoLabel(name))) continue;
    otherByName.set(name, (otherByName.get(name) ?? 0) + row.count);
  }
  const others = [...otherByName.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const othersTotal = others.reduce((total, line) => total + line.count, 0);

  // Indicações e média: ofertas aceitas na mesma janela, sem as filas de indicação excluídas.
  const morningLeads = new Set<string>();
  const afternoonLeads = new Set<string>();
  const excludedQueue = normalizePlantaoLabel(config.queues.indicationsExcludedQueue);
  const excludedDutyPrefix = normalizePlantaoLabel(config.duties.indicationsExcludedPrefix);
  for (const offer of offers) {
    const excludedByQueue = offer.originalQueueName && normalizePlantaoLabel(offer.originalQueueName) === excludedQueue;
    const excludedByDuty = offer.dutyName && normalizePlantaoLabel(offer.dutyName).startsWith(excludedDutyPrefix);
    if (excludedByQueue || excludedByDuty) continue;
    (isAfternoon(offer.offeredAt) ? afternoonLeads : morningLeads).add(offer.leadId);
  }
  const indications = { morning: morningLeads.size, afternoon: afternoonLeads.size };

  const isPme = (name: string) => name.startsWith(normalizePlantaoLabel(config.duties.pmePrefix));
  const isPremium = (name: string) => !isPme(name) && name.startsWith(normalizePlantaoLabel(config.duties.premiumName));
  const presencialPrefix = normalizePlantaoLabel(config.duties.presencialPrefix);
  const isPresencialMorning = (name: string) => !isPme(name) && name.startsWith(presencialPrefix) && name.includes("manha");
  const isPresencialAfternoon = (name: string) => !isPme(name) && name.startsWith(presencialPrefix) && name.includes("tarde");
  const quantity = {
    pme: averagesFor(offers, (name) => isPme(name), "all"),
    onlineMorning: averagesFor(offers, (name) => isPremium(name), "morning"),
    onlineAfternoon: averagesFor(offers, (name) => isPremium(name), "afternoon"),
    inPersonMorning: averagesFor(offers, (name) => isPresencialMorning(name), "morning"),
    inPersonAfternoon: averagesFor(offers, (name) => isPresencialAfternoon(name), "afternoon"),
  };

  // EXTERNO + INTERNO + OUTRAS = TOTAL GERADO: cada lead cai numa única fila de entrada.
  if (externalTotal + internalTotal + othersTotal !== generatedTotal) throw new Error("plantao_report_total_mismatch");
  return {
    generated: { total: generatedTotal },
    external: { total: externalTotal, details },
    internal: { total: internalTotal, queues: internalQueues },
    others: { total: othersTotal, queues: others },
    indications,
    quantity,
  };
}

const PLANTAO_DAY_MS = 24 * 60 * 60 * 1000;
/** Dia de operação: vai de 19h a 19h (SP), igual à tela de Qualidade. */
export const PLANTAO_WINDOW_CUT_HOUR = 19;

function shiftDayKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** 19h de uma data (SP) como instante UTC. São Paulo não tem horário de verão: UTC-3 o ano todo. */
function cutAt(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, PLANTAO_WINDOW_CUT_HOUR + 3));
}

function weekdayIndex(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

/**
 * Janela do relatório enviado hoje às 19h: do último 19h anterior até 19h de hoje.
 * Terça a sexta: ontem 19h → hoje 19h. Segunda: sexta 19h → segunda 19h (sábado e domingo não são enviados).
 */
export function plantaoReportWindow(now: Date): { since: Date; until: Date; reportedDayKey: string } {
  const reportedDayKey = plantaoReportDayKey(now);
  const startsDaysBack = weekdayIndex(reportedDayKey) === 1 ? 3 : 1;
  const until = cutAt(reportedDayKey);
  return { since: cutAt(shiftDayKey(reportedDayKey, -startsDaysBack)), until, reportedDayKey };
}

/** Sábado e domingo não têm relatório: o envio é pulado nesses dias. */
export function plantaoSendsOn(now: Date) {
  const day = weekdayIndex(plantaoReportDayKey(now));
  return day !== 0 && day !== 6;
}

/** "Resultado do plantão · 12/11 (11/11 19h → 12/11 19h)": título com o período coberto. */
export function plantaoReportTitle(reportedDayKey: string) {
  const window = plantaoReportWindow(new Date(`${reportedDayKey}T12:00:00-03:00`));
  const [, sinceMonth, sinceDay] = plantaoReportDayKey(window.since).split("-");
  const [, month, day] = reportedDayKey.split("-");
  return `Resultado do plantão · ${day}/${month} (${sinceDay}/${sinceMonth} 19h → ${day}/${month} 19h)`;
}

function whole(value: number) {
  return String(Math.max(0, Math.trunc(value)));
}

function averageRoundedUp(value: number) {
  return String(Math.max(0, Math.ceil(value)));
}

export function plantaoReportDayKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function plantaoReportDayStart(now: Date) {
  return new Date(`${plantaoReportDayKey(now)}T03:00:00.000Z`);
}

export function plantaoReportLocalHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** Nome curto da fila no relatório: sem o prefixo "FILA " (o aviso tem limite de 512 caracteres). */
function shortQueueName(name: string) {
  return name.replace(/^fila\s+/i, "");
}

export function buildPlantaoReportText(metrics: PlantaoReportMetrics, now: Date) {
  const reported = plantaoReportWindow(now).reportedDayKey;
  const lines = [
    `📊 *${plantaoReportTitle(reported)}*`,
    "",
    `*Total gerado* · ${whole(metrics.generated.total)} leads`,
    `*EXTERNO* · ${whole(metrics.external.total)} leads`,
  ];
  if (metrics.external.details) {
    // Só as partes com leads: sem "RD 0" quando a fila é toda WhatsApp.
    const parts = [
      metrics.external.details.whatsapp > 0 ? `WhatsApp ${whole(metrics.external.details.whatsapp)}` : null,
      metrics.external.details.rd > 0 ? `RD ${whole(metrics.external.details.rd)}` : null,
    ].filter((part): part is string => part !== null);
    if (parts.length) lines.push(parts.join(" · "));
  }
  lines.push(`*INTERNO* · ${whole(metrics.internal.total)} leads`);
  for (const queue of metrics.internal.queues) lines.push(`${shortQueueName(queue.name)}: ${whole(queue.count)}`);
  lines.push(`*Outras filas* · ${whole(metrics.others.total)} leads`);
  for (const queue of metrics.others.queues) lines.push(`${shortQueueName(queue.name)}: ${whole(queue.count)}`);
  lines.push(
    "",
    `*Indicações* 🌅 ${whole(metrics.indications.morning)} · 🌇 ${whole(metrics.indications.afternoon)}`,
    `*Média por corretor* PME ${averageRoundedUp(metrics.quantity.pme)} · Online ${averageRoundedUp(metrics.quantity.onlineMorning)}/${averageRoundedUp(metrics.quantity.onlineAfternoon)} · Presencial ${averageRoundedUp(metrics.quantity.inPersonMorning)}/${averageRoundedUp(metrics.quantity.inPersonAfternoon)}`,
  );
  return lines.join("\n");
}
