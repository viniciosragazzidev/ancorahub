/**
 * Dados de exemplo do painel ao vivo (sem banco). Os números seguem as regras que já existem no código,
 * para o exemplo virar implementação depois (ver NOTAS.md):
 * - turnos: manhã e tarde divididos às 13:30 (`DEFAULT_SHIFT_SPLIT_AT` em lead-distribution/duty-shifts.ts),
 *   noite e o extra da noite (DEC-152, `overnightExtraReceiptGap` em received-in-day-core.ts);
 * - lead recebido = oferta com corretor e não cancelada (`countsAsReceived`);
 * - presença confirmada pelo WhatsApp antes de receber (duty-presence*);
 * - média por corretor = leads ÷ corretores que receberam, como o "Resultado do Plantão" (plantao-report-core.ts);
 * - filas (não são plantões): as mesmas do "Resultado do Plantão" (`DEFAULT_PLANTAO_REPORT_CONFIG.queues`),
 *   e a Fila TATIANA separada em formulário e WhatsApp por `classifyPlantaoLead`.
 */

/** Fila de entrada do lead. A fila diz de onde o lead veio; o plantão diz quem atende. */
export type OrigemKey = "tatianaForm" | "tatianaWhatsapp" | "renanPf" | "renanPme" | "renanWhatsapp";
export type Origens = Record<OrigemKey, number>;
export const ORIGEM_KEYS: OrigemKey[] = ["tatianaForm", "tatianaWhatsapp", "renanPf", "renanPme", "renanWhatsapp"];

export type FilaColumn = { key: OrigemKey; group: "Tatiana" | "Renan"; short: string; tile: string; label: string; queue: string };
export const FILA_COLUMNS: FilaColumn[] = [
  { key: "tatianaForm", group: "Tatiana", short: "Form", tile: "Formulário", label: "Tatiana · Form", queue: "Fila TATIANA (formulário)" },
  { key: "tatianaWhatsapp", group: "Tatiana", short: "WhatsApp", tile: "WhatsApp", label: "Tatiana · WhatsApp", queue: "Fila TATIANA (WhatsApp)" },
  { key: "renanPf", group: "Renan", short: "Form PF", tile: "Formulário PF", label: "Renan · Form PF", queue: "Fila PF - Renan" },
  { key: "renanPme", group: "Renan", short: "Form PME", tile: "Formulário PME", label: "Renan · Form PME", queue: "Fila PME - Renan" },
  { key: "renanWhatsapp", group: "Renan", short: "WhatsApp", tile: "WhatsApp", label: "Renan · WhatsApp", queue: "Whatsapp Renan" },
];

export type TurnoKey = "manha" | "tarde" | "noite" | "extra";
export type TurnoState = "encerrado" | "agora" | "depois";

export type Turno = {
  key: TurnoKey;
  label: string;
  hours: string;
  startsAt: string;
  leads: number;
  state: TurnoState;
  /** Leads do turno por fila. O que sobra de `leads` vem de outras origens (indicação, frios, outras filas). */
  origens: Origens;
};

export type Plantao = {
  id: string;
  name: string;
  hours: string;
  state: "encerrado" | "agora" | "depois";
  escalados: number;
  confirmaram: number;
  recebendo: number;
  /** Leads que este plantão já recebeu hoje. */
  leads: number;
  /** Corretores deste plantão que já receberam pelo menos um lead hoje. */
  receberam: number;
};

export type LiveData = {
  /** Horário simulado de abertura do exemplo (São Paulo). */
  startClock: { hour: number; minute: number };
  dateLabel: string;
  turnos: Turno[];
  plantoes: Plantao[];
  /** Leads de ontem até este mesmo horário. */
  yesterdaySameTime: number;
  /** Média por corretor ontem neste horário. */
  yesterdayAverage: number;
};

export const LIVE_EXAMPLE: LiveData = {
  startClock: { hour: 14, minute: 32 },
  dateLabel: "Terça, 10 de novembro",
  turnos: [
    { key: "manha", label: "Manhã", hours: "08:00 às 13:30", startsAt: "08:00", leads: 86, state: "encerrado", origens: { tatianaForm: 14, tatianaWhatsapp: 37, renanPf: 12, renanPme: 9, renanWhatsapp: 7 } },
    { key: "tarde", label: "Tarde", hours: "13:30 às 19:00", startsAt: "13:30", leads: 23, state: "agora", origens: { tatianaForm: 4, tatianaWhatsapp: 9, renanPf: 4, renanPme: 2, renanWhatsapp: 2 } },
    { key: "noite", label: "Noite", hours: "19:00 às 23:00", startsAt: "19:00", leads: 0, state: "depois", origens: { tatianaForm: 0, tatianaWhatsapp: 0, renanPf: 0, renanPme: 0, renanWhatsapp: 0 } },
    { key: "extra", label: "Extra da noite", hours: "23:00 às 02:00", startsAt: "23:00", leads: 0, state: "depois", origens: { tatianaForm: 0, tatianaWhatsapp: 0, renanPf: 0, renanPme: 0, renanWhatsapp: 0 } },
  ],
  plantoes: [
    { id: "pf-manha", name: "Pessoa física manhã", hours: "08:00 às 13:30", state: "encerrado", escalados: 14, confirmaram: 13, recebendo: 0, leads: 44, receberam: 12 },
    { id: "pf-tarde", name: "Pessoa física tarde", hours: "13:30 às 19:00", state: "agora", escalados: 16, confirmaram: 14, recebendo: 12, leads: 14, receberam: 9 },
    { id: "pme", name: "Empresas (PME)", hours: "09:00 às 18:00", state: "agora", escalados: 6, confirmaram: 5, recebendo: 5, leads: 27, receberam: 5 },
    { id: "presencial", name: "Presencial Barra", hours: "10:00 às 16:00", state: "agora", escalados: 4, confirmaram: 4, recebendo: 3, leads: 24, receberam: 4 },
    { id: "noite", name: "Noite", hours: "19:00 às 23:00", state: "depois", escalados: 9, confirmaram: 0, recebendo: 0, leads: 0, receberam: 0 },
  ],
  yesterdaySameTime: 97,
  yesterdayAverage: 3.3,
};

export const sumOrigens = (turnos: readonly Turno[]): Origens =>
  Object.fromEntries(ORIGEM_KEYS.map((key) => [key, turnos.reduce((sum, turno) => sum + turno.origens[key], 0)])) as Origens;

export const totalLeads = (turnos: readonly Turno[]) => turnos.reduce((sum, turno) => sum + turno.leads, 0);

/** Média de leads por corretor que recebeu hoje, uma casa decimal. */
export function averagePerBroker(plantoes: readonly Pick<Plantao, "leads" | "receberam">[]) {
  const leads = plantoes.reduce((sum, plantao) => sum + plantao.leads, 0);
  const brokers = plantoes.reduce((sum, plantao) => sum + plantao.receberam, 0);
  return brokers ? Math.round((leads / brokers) * 10) / 10 : 0;
}

export function percentChange(now: number, before: number) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

/** Sequência das filas na simulação (proporção parecida com a do dia; null = outra origem, como indicação). */
const ORIGEM_CYCLE: (OrigemKey | null)[] = ["tatianaWhatsapp", "renanPf", "tatianaWhatsapp", "renanPme", "tatianaForm", "tatianaWhatsapp", "renanWhatsapp", "renanPf", "tatianaWhatsapp", null];
/** Plantão que atende cada fila no exemplo (fila PME vai para o plantão PME; outra origem, para o presencial). */
const PLANTAO_BY_FILA: Record<OrigemKey | "outra", string> = { tatianaForm: "pf-tarde", tatianaWhatsapp: "pf-tarde", renanPf: "pf-tarde", renanPme: "pme", renanWhatsapp: "pf-tarde", outra: "presencial" };

const FIRST_NAMES = ["Bruno", "Camila", "Diego", "Fernanda", "Juliana", "Marcos", "Patrícia", "Rafael", "Tatiane", "Vitor"];

export type LiveEvent =
  | { kind: "lead"; plantaoId: string; turno: TurnoKey; firstContact: boolean; origem: OrigemKey | null }
  | { kind: "presenca"; plantaoId: string; broker: string };

/**
 * Próximo acontecimento da simulação. Na maioria das vezes chega um lead numa fila e vai para o plantão que
 * atende essa fila; de vez em quando um corretor que faltava confirma presença.
 */
export function nextEvent(data: Pick<LiveData, "plantoes">, step: number): LiveEvent | null {
  const running = data.plantoes.filter((plantao) => plantao.state === "agora");
  if (!running.length) return null;
  const missing = running.find((plantao) => plantao.confirmaram < plantao.escalados);
  if (missing && step % 4 === 3) return { kind: "presenca", plantaoId: missing.id, broker: FIRST_NAMES[step % FIRST_NAMES.length] };
  const origem = ORIGEM_CYCLE[step % ORIGEM_CYCLE.length];
  const plantaoId = PLANTAO_BY_FILA[origem ?? "outra"];
  return { kind: "lead", plantaoId: running.some((plantao) => plantao.id === plantaoId) ? plantaoId : running[0].id, turno: "tarde", firstContact: step % 3 === 0, origem };
}

export function applyEvent(data: LiveData, event: LiveEvent): LiveData {
  if (event.kind === "presenca") {
    return {
      ...data,
      plantoes: data.plantoes.map((plantao) => (plantao.id === event.plantaoId
        ? { ...plantao, confirmaram: plantao.confirmaram + 1, recebendo: plantao.recebendo + 1 }
        : plantao)),
    };
  }
  return {
    ...data,
    turnos: data.turnos.map((turno) => (turno.key === event.turno ? { ...turno, leads: turno.leads + 1, origens: event.origem ? { ...turno.origens, [event.origem]: turno.origens[event.origem] + 1 } : turno.origens } : turno)),
    plantoes: data.plantoes.map((plantao) => (plantao.id === event.plantaoId
      ? { ...plantao, leads: plantao.leads + 1, receberam: event.firstContact && plantao.receberam < plantao.confirmaram ? plantao.receberam + 1 : plantao.receberam }
      : plantao)),
  };
}
