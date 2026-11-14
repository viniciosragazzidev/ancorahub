import type { BrokerDutyCalendarOccurrence, BrokerDutyCalendarResult } from "./duty-calendar";
import type { BrokerActiveDuty, BrokerWorkspaceData, DutyPresenceAsk } from "./queries";

/**
 * Plantões em uma entrada única (plano do modo corretor, etapa 3): o cartão "Seu plantão atual" de `/plantoes`.
 * Só reorganiza o que o servidor já carregou (plantões em andamento, próximo plantão, confirmações de presença e o
 * calendário pessoal); não decide distribuição, presença ou escala.
 */

const TIME_ZONE = "America/Sao_Paulo";

export type DutyHubTone = "neutral" | "success" | "info" | "warning";

export type DutyHubShift = {
  key: string;
  scheduleName: string;
  /** "Hoje", "Amanhã" ou a data por extenso. */
  dateLabel: string;
  /** "13:00 às 17:00". */
  timeLabel: string;
  place: string | null;
  modality: "Presencial" | "Online" | null;
  situation: { label: string; tone: DutyHubTone };
  /** Uma frase curta sobre o que fazer agora, quando houver. */
  hint: string | null;
  /** Abre a operação do plantão (ou a confirmação de presença). Null quando ainda não há o que abrir. */
  href: string | null;
};

export type DutyHubCurrent =
  /** Um ou mais plantões em andamento; com mais de um, o corretor escolhe qual abrir. */
  | { state: "active"; shifts: DutyHubShift[]; coveredOccurrenceIds: string[] }
  /** Nenhum plantão agora: mostra o próximo. */
  | { state: "next"; shifts: [DutyHubShift]; coveredOccurrenceIds: string[] }
  /** A escala carregou e não há plantão marcado. */
  | { state: "none"; shifts: []; coveredOccurrenceIds: [] }
  /** Algo não carregou: não dá para afirmar que não há escala. */
  | { state: "error"; shifts: []; coveredOccurrenceIds: [] };

type WorkspaceDuty = BrokerWorkspaceData["duty"];
type ActiveDuty = BrokerActiveDuty;
type PresenceAsk = DutyPresenceAsk;

const dateKeyOf = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const timeOf = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

/** "Hoje", "Amanhã" ou "Quarta-feira, 30 de setembro" (a data do plantão é um dia civil, formatado em UTC ao meio-dia). */
export function dutyDateLabel(dutyDate: string, todayKey: string) {
  if (dutyDate === todayKey) return "Hoje";
  if (dutyDate === addDays(todayKey, 1)) return "Amanhã";
  const label = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${dutyDate}T12:00:00.000Z`));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function modalityOf(mode: string | undefined | null): DutyHubShift["modality"] {
  if (mode === "presencial") return "Presencial";
  if (mode === "online") return "Online";
  return null;
}

const askHref = (ask: PresenceAsk) => `/plantoes/agora?assignment=${encodeURIComponent(ask.assignmentId)}`;

function askSituation(ask: PresenceAsk): Pick<DutyHubShift, "situation" | "hint"> {
  if (ask.status === "awaiting_release") {
    return { situation: { label: "Aguardando liberação", tone: "info" }, hint: "Sua foto chegou para o diretor. Os leads começam a chegar assim que ele liberar." };
  }
  return {
    situation: { label: "Confirme sua presença", tone: "warning" },
    hint: ask.mode === "presencial" ? "Quando chegar à unidade, tire uma foto do local para começar a receber leads." : "Confirme sua presença para começar a receber leads.",
  };
}

function activeShift(duty: ActiveDuty, ask: PresenceAsk | undefined, todayKey: string, choose: boolean): DutyHubShift {
  const base = `/plantoes/agora${choose ? `?plantao=${encodeURIComponent(duty.scheduleId)}` : ""}`;
  const state: Pick<DutyHubShift, "situation" | "hint"> = ask
    ? askSituation(ask)
    : duty.presenceStatus === "pending"
      ? { situation: { label: "Aguardando liberação", tone: "info" }, hint: "Assim que o gestor confirmar sua presença, os leads começam a chegar." }
      : duty.paused
        ? { situation: { label: "Pausado", tone: "warning" }, hint: "Você não recebe leads enquanto estiver pausado." }
        : { situation: { label: "Recebendo leads", tone: "success" }, hint: null };
  return {
    key: `active:${duty.scheduleId}`,
    scheduleName: duty.scheduleName,
    dateLabel: dutyDateLabel(duty.dutyDate, todayKey),
    timeLabel: `${timeOf(duty.startsAt)} às ${timeOf(duty.endsAt)}`,
    place: duty.branchName,
    modality: modalityOf(duty.attendanceMode),
    ...state,
    href: ask ? askHref(ask) : base,
  };
}

function occurrenceTime(occurrence: BrokerDutyCalendarOccurrence) {
  return `${occurrence.startsAt.slice(0, 5)} às ${occurrence.endsAt.slice(0, 5)}${occurrence.endsNextDay ? " do dia seguinte" : ""}`;
}

export function buildDutyHubCurrent(input: {
  now: Date;
  /** Null quando o carregamento falhou. */
  duty: WorkspaceDuty | undefined;
  workspaceFailed: boolean;
  /** Null quando o calendário está desligado ou não carregou. */
  calendar: BrokerDutyCalendarResult | null;
  calendarFailed: boolean;
}): DutyHubCurrent {
  if (input.workspaceFailed) return { state: "error", shifts: [], coveredOccurrenceIds: [] };
  const todayKey = dateKeyOf(input.now);
  const duty = input.duty ?? null;
  const running = duty?.activeAll?.length ? duty.activeAll : duty?.active ? [duty.active] : [];
  const asks = (duty?.presences ?? (duty?.presence ? [duty.presence] : [])).filter((ask) => ask.status !== "confirmed");
  const occurrences = input.calendar?.occurrences ?? [];

  if (running.length) {
    const choose = running.length > 1;
    const runningIds = new Set(running.map((item) => item.scheduleId));
    return {
      state: "active",
      shifts: running.map((item) => activeShift(item, asks.find((ask) => ask.scheduleId === item.scheduleId), todayKey, choose)),
      coveredOccurrenceIds: occurrences.filter((item) => item.inProgress && runningIds.has(item.scheduleId)).map((item) => item.id),
    };
  }

  // Confirmação aberta antes do início (30 min): é o plantão que importa agora.
  const ask = asks[0];
  if (ask) {
    const dutyDate = dateKeyOf(ask.startsAt);
    return {
      state: "next",
      shifts: [{
        key: `ask:${ask.assignmentId}`,
        scheduleName: ask.scheduleName,
        dateLabel: dutyDateLabel(dutyDate, todayKey),
        timeLabel: `${timeOf(ask.startsAt)} às ${timeOf(ask.endsAt)}`,
        place: ask.branchName,
        modality: modalityOf(ask.mode),
        ...askSituation(ask),
        href: askHref(ask),
      }],
      coveredOccurrenceIds: occurrences.filter((item) => item.scheduleId === ask.scheduleId && item.dutyDate === dutyDate).map((item) => item.id),
    };
  }

  const upcoming = occurrences.find((item) => !item.inProgress);
  if (upcoming) {
    return {
      state: "next",
      shifts: [{
        key: `next:${upcoming.id}`,
        scheduleName: upcoming.scheduleName,
        dateLabel: dutyDateLabel(upcoming.dutyDate, todayKey),
        timeLabel: occurrenceTime(upcoming),
        place: upcoming.branchName,
        modality: null,
        situation: upcoming.paused ? { label: "Pausado", tone: "warning" } : { label: "Próximo plantão", tone: "neutral" },
        hint: upcoming.paused ? "Este plantão está pausado temporariamente." : null,
        href: null,
      }],
      coveredOccurrenceIds: [upcoming.id],
    };
  }

  const next = duty?.next;
  if (next) {
    return {
      state: "next",
      shifts: [{
        key: `next:${next.dutyDate}:${next.scheduleName}`,
        scheduleName: next.scheduleName,
        dateLabel: dutyDateLabel(next.dutyDate, todayKey),
        timeLabel: `${timeOf(next.startsAt)} às ${timeOf(next.endsAt)}`,
        place: null,
        modality: null,
        situation: next.paused ? { label: "Pausado", tone: "warning" } : { label: "Próximo plantão", tone: "neutral" },
        hint: next.paused ? "Este plantão está pausado temporariamente." : null,
        href: null,
      }],
      coveredOccurrenceIds: [],
    };
  }

  // Sem nada a mostrar: só afirma que não há escala quando tudo carregou.
  if (input.calendarFailed) return { state: "error", shifts: [], coveredOccurrenceIds: [] };
  return { state: "none", shifts: [], coveredOccurrenceIds: [] };
}
