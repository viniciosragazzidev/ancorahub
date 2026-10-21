/**
 * Troca de corretores entre dois plantões da escala publicada (21/10). Regras
 * puras (testadas): a action só carrega os dados e grava; as decisões ficam aqui.
 *
 * A troca vale para linhas com data (escala publicada) e para a linha semanal de
 * um plantão que só acontece uma vez (validade com uma única data daquele dia da
 * semana, ex.: "Presencial 09/11 · Manhã"). A escala semanal de verdade não troca
 * por aqui: mudar o corretor dela mudaria todas as semanas.
 */
import { dayOfWeekOf, isValidOn, localDateKey, zonedMidnight } from "./monthly-duty-plan";

export type SwapSlot = {
  id: string;
  status: string;
  scheduleId: string;
  scheduleName: string;
  scheduleStatus: string;
  /** Unit of the plantão; null = plantão global (any unit). */
  scheduleBranchId: string | null;
  brokerId: string;
  /**
   * Date of the slot: the published date, or the only date of a weekly row whose plantão
   * happens once. Null = weekly roster row that repeats (not swappable).
   */
  dutyDate: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  /** Set on weekly rows (duty_date NULL): its weekday and the plantão's validity. */
  weekly?: WeeklyWindow | null;
};

export type WeeklyWindow = { dayOfWeek: number; validFrom: Date; validUntil: Date | null };

export type SwapBroker = {
  id: string;
  name: string;
  /** Membership unit of the broker in the tenant. */
  branchId: string | null;
  /** Active broker of the tenant, inside the escala inclusion policy, with an active unit. */
  eligible: boolean;
};

export type SwapActor = { role: string; branchId: string | null };

const SAO_PAULO = "America/Sao_Paulo";

/** Start instant of a dated slot, in the plantão's time zone. */
export function slotStartsAt(slot: Pick<SwapSlot, "dutyDate" | "startsAt" | "timezone">): Date | null {
  if (!slot.dutyDate) return null;
  const [hours, minutes] = slot.startsAt.split(":").map(Number);
  return new Date(zonedMidnight(slot.dutyDate, slot.timezone || SAO_PAULO).getTime() + (hours * 60 + minutes) * 60_000);
}

const DAY_MS = 24 * 3600_000;

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * The only date of a weekly row (duty_date NULL) when its plantão's validity holds exactly one
 * day of that weekday (the shift starting inside [validFrom, validUntil), dates in the plantão's
 * time zone), e.g. "PRESENCIAL MANHÃ" valid 30/10 to 31/10. Open-ended or several weeks = null:
 * the row repeats, and changing it would change every week.
 */
export function singleWeeklyOccurrenceDate(window: WeeklyWindow, startsAt: string, timezone: string = SAO_PAULO): string | null {
  if (!window.validUntil || window.validUntil.getTime() <= window.validFrom.getTime()) return null;
  // Over 15 days always holds the weekday at least twice.
  if (window.validUntil.getTime() - window.validFrom.getTime() > 15 * DAY_MS) return null;
  const tz = timezone || SAO_PAULO;
  const schedule = { startsAt, timezone: tz, validFrom: window.validFrom, validUntil: window.validUntil };
  const dates: string[] = [];
  const last = localDateKey(new Date(window.validUntil.getTime() + DAY_MS), tz);
  for (let date = localDateKey(new Date(window.validFrom.getTime() - DAY_MS), tz); date <= last && dates.length < 2; date = addDays(date, 1)) {
    if (dayOfWeekOf(date) === window.dayOfWeek && isValidOn(schedule, date)) dates.push(date);
  }
  return dates.length === 1 ? dates[0] : null;
}

/** Date the swap works with: the published date, or the single date of a one-time weekly row. */
export function effectiveSwapDate(row: { dutyDate: string | null; startsAt: string; timezone: string; weekly?: WeeklyWindow | null }) {
  if (row.dutyDate) return row.dutyDate;
  return row.weekly ? singleWeeklyOccurrenceDate(row.weekly, row.startsAt, row.timezone) : null;
}

export type CoverageRow = Pick<SwapSlot, "status" | "scheduleId" | "brokerId" | "dutyDate" | "startsAt" | "timezone" | "weekly">;

/** The row puts its broker on the plantão on `dutyDate`: same date, or a weekly row in force that day. */
export function rowCoversDate(row: CoverageRow, scheduleId: string, dutyDate: string) {
  if (row.status !== "active" || row.scheduleId !== scheduleId) return false;
  if (row.dutyDate === dutyDate) return true;
  if (!row.weekly || dayOfWeekOf(dutyDate) !== row.weekly.dayOfWeek) return false;
  return isValidOn({ startsAt: row.startsAt, timezone: row.timezone || SAO_PAULO, validFrom: row.weekly.validFrom, validUntil: row.weekly.validUntil }, dutyDate);
}

export function slotStarted(slot: Pick<SwapSlot, "dutyDate" | "startsAt" | "timezone">, now: Date) {
  const start = slotStartsAt(slot);
  return !start || start.getTime() <= now.getTime();
}

/** "24/10" from "2026-10-24". */
export function shortDutyDate(dutyDate: string) {
  return `${dutyDate.slice(8, 10)}/${dutyDate.slice(5, 7)}`;
}

/** "sexta-feira, 24/10" from "2026-10-24". */
export function longDutyDate(dutyDate: string) {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${dutyDate}T12:00:00Z`));
  return `${weekday}, ${shortDutyDate(dutyDate)}`;
}

export const NOT_SWAPPABLE_WEEKLY = "A troca vale só para plantões com data (escala publicada ou plantão de um dia só). A escala semanal que se repete não troca por aqui.";

export function canManageSwaps(role: string) {
  return role === "director" || role === "manager";
}

/** The plantão and both brokers are inside the actor's scope (Gestor: own unit; Diretor: all). */
export function slotInActorScope(actor: SwapActor, slot: Pick<SwapSlot, "scheduleBranchId">, brokerBranchId: string | null) {
  if (actor.role === "director") return true;
  if (actor.role !== "manager" || !actor.branchId) return false;
  if (slot.scheduleBranchId && slot.scheduleBranchId !== actor.branchId) return false;
  return brokerBranchId === actor.branchId;
}

export type SwapProblemInput = {
  actor: SwapActor;
  source: SwapSlot | null;
  target: SwapSlot | null;
  sourceBroker: SwapBroker | null;
  targetBroker: SwapBroker | null;
  /** The source broker is already on the target plantão and day (another row, published or weekly). */
  sourceBrokerAlreadyOnTarget: boolean;
  /** The target broker is already on the source plantão and day. */
  targetBrokerAlreadyOnSource: boolean;
  now: Date;
};

/** Mensagem de erro, ou null quando a troca pode ser feita. */
export function dutySwapProblem(input: SwapProblemInput): string | null {
  const { actor, source, target, sourceBroker, targetBroker, now } = input;
  if (!canManageSwaps(actor.role)) return "Apenas Diretores e Gestores podem trocar corretores da escala.";
  if (!source || !target || source.status !== "active" || target.status !== "active") return "Uma das escalações não existe mais. Atualize a página.";
  if (source.id === target.id) return "Escolha outra escalação para a troca.";
  if (!source.dutyDate || !target.dutyDate) return NOT_SWAPPABLE_WEEKLY;
  if (source.scheduleStatus !== "active") return `O plantão ${source.scheduleName} não está mais ativo.`;
  if (target.scheduleStatus !== "active") return `O plantão ${target.scheduleName} não está mais ativo.`;
  for (const slot of [source, target]) {
    if (slotStarted(slot, now)) return `O plantão ${slot.scheduleName} de ${shortDutyDate(slot.dutyDate!)} já começou. Só dá para trocar plantões que ainda não começaram.`;
  }
  if (source.brokerId === target.brokerId) return "Os dois plantões são do mesmo corretor.";
  if (source.scheduleId === target.scheduleId && source.dutyDate === target.dutyDate) return "Os dois corretores já estão neste mesmo plantão.";
  if (!sourceBroker || !targetBroker) return "Corretor não encontrado. Atualize a página.";
  for (const broker of [sourceBroker, targetBroker]) {
    if (!broker.eligible || !broker.branchId) return `${broker.name} está fora da escala (conta inativa ou sem unidade).`;
  }
  if (!slotInActorScope(actor, source, sourceBroker.branchId) || !slotInActorScope(actor, target, targetBroker.branchId)
    || !slotInActorScope(actor, source, targetBroker.branchId) || !slotInActorScope(actor, target, sourceBroker.branchId)) {
    return "Você só pode trocar corretores e plantões da sua unidade.";
  }
  // Same rule as the roster: a plantão of one unit only takes brokers of that unit.
  if (target.scheduleBranchId && sourceBroker.branchId !== target.scheduleBranchId) return `A unidade de ${sourceBroker.name} não é a do plantão ${target.scheduleName}.`;
  if (source.scheduleBranchId && targetBroker.branchId !== source.scheduleBranchId) return `A unidade de ${targetBroker.name} não é a do plantão ${source.scheduleName}.`;
  if (input.sourceBrokerAlreadyOnTarget) return `${sourceBroker.name} já está no plantão ${target.scheduleName} em ${shortDutyDate(target.dutyDate)}.`;
  if (input.targetBrokerAlreadyOnSource) return `${targetBroker.name} já está no plantão ${source.scheduleName} em ${shortDutyDate(source.dutyDate)}.`;
  return null;
}

export type SwapCandidateRow = SwapSlot & { brokerName: string; brokerBranchId: string | null; brokerCode?: string | null };

export type SwapCandidate = {
  assignmentId: string;
  brokerId: string;
  brokerName: string;
  brokerCode: string | null;
  scheduleName: string;
  dutyDate: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Future slots the source can swap with (published rows and one-time weekly rows): not
 * started, in the actor's scope, another broker, not the same plantão and day, and no
 * broker would end up twice on one plantão and day. `rows` are the active dated rows and
 * the active weekly rows (all units: the duplicate check needs them, repeating weekly rows
 * included); `dutyDate` of a weekly row is its single date, or null when it repeats.
 */
export function selectSwapCandidates(source: SwapCandidateRow, rows: readonly SwapCandidateRow[], actor: SwapActor, now: Date): SwapCandidate[] {
  const byScheduleBroker = new Map<string, SwapCandidateRow[]>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    const key = `${row.scheduleId}|${row.brokerId}`;
    byScheduleBroker.set(key, [...(byScheduleBroker.get(key) ?? []), row]);
  }
  const onPlantao = (brokerId: string, scheduleId: string, dutyDate: string, ignoredIds: readonly string[]) =>
    (byScheduleBroker.get(`${scheduleId}|${brokerId}`) ?? []).some((row) => !ignoredIds.includes(row.id) && rowCoversDate(row, scheduleId, dutyDate));
  return rows
    .filter((row) => row.id !== source.id
      && row.status === "active"
      && row.scheduleStatus === "active"
      && row.dutyDate
      && row.brokerId !== source.brokerId
      && !(row.scheduleId === source.scheduleId && row.dutyDate === source.dutyDate)
      && !slotStarted(row, now)
      && slotInActorScope(actor, row, row.brokerBranchId)
      && slotInActorScope(actor, row, source.brokerBranchId)
      && slotInActorScope(actor, source, row.brokerBranchId)
      && (!row.scheduleBranchId || row.scheduleBranchId === source.brokerBranchId)
      && (!source.scheduleBranchId || source.scheduleBranchId === row.brokerBranchId)
      && !onPlantao(source.brokerId, row.scheduleId, row.dutyDate, [source.id, row.id])
      && !onPlantao(row.brokerId, source.scheduleId, source.dutyDate!, [source.id, row.id]))
    .sort((a, b) => `${a.dutyDate} ${a.startsAt} ${a.scheduleName} ${a.brokerName}`.localeCompare(`${b.dutyDate} ${b.startsAt} ${b.scheduleName} ${b.brokerName}`, "pt-BR"))
    .map((row) => ({ assignmentId: row.id, brokerId: row.brokerId, brokerName: row.brokerName, brokerCode: row.brokerCode ?? null, scheduleName: row.scheduleName, dutyDate: row.dutyDate!, startsAt: row.startsAt, endsAt: row.endsAt }));
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

/** Picker search: every word typed is part of the broker name, code, plantão or date ("ros", "Rosane", "26/10"). */
export function swapCandidateMatches(candidate: SwapCandidate, query: string) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeSearch(`${candidate.brokerName} ${candidate.brokerCode ?? ""} ${candidate.scheduleName} ${shortDutyDate(candidate.dutyDate)} ${longDutyDate(candidate.dutyDate)} ${candidate.dutyDate}`);
  return words.every((word) => haystack.includes(word));
}

type PlanEntry = { occurrenceId: string; brokerId: string; rosterAssignmentId?: string } & Record<string, unknown>;
type PlanOccurrence = { id: string; allowedBrokerIds?: string[]; forcedBrokerIds?: string[] } & Record<string, unknown>;
export type SwapMove = { occurrenceId: string; fromBrokerId: string; toBrokerId: string };

/**
 * The escala (published plan and a newer draft) lists who is on each plantão: the
 * swap changes the broker of both entries, so the planner and a republication show
 * the same people. A broker moved into a plantão of another type stays allowed there.
 */
export function swapPlanAssignments(plan: { assignments: unknown; occurrences: unknown }, moves: readonly SwapMove[]) {
  const assignments = Array.isArray(plan.assignments) ? (plan.assignments as PlanEntry[]) : [];
  const occurrences = Array.isArray(plan.occurrences) ? (plan.occurrences as PlanOccurrence[]) : [];
  let changed = false;
  const nextAssignments = assignments.map((entry) => {
    const move = moves.find((item) => item.occurrenceId === entry.occurrenceId && item.fromBrokerId === entry.brokerId);
    if (!move) return entry;
    changed = true;
    return { ...entry, brokerId: move.toBrokerId };
  });
  if (!changed) return { changed: false as const, assignments, occurrences };
  const nextOccurrences = occurrences.map((occurrence) => {
    const move = moves.find((item) => item.occurrenceId === occurrence.id);
    if (!move || (occurrence.allowedBrokerIds ?? []).includes(move.toBrokerId)) return occurrence;
    return {
      ...occurrence,
      allowedBrokerIds: [...(occurrence.allowedBrokerIds ?? []), move.toBrokerId],
      forcedBrokerIds: [...new Set([...(occurrence.forcedBrokerIds ?? []), move.toBrokerId])],
    };
  });
  return { changed: true as const, assignments: nextAssignments, occurrences: nextOccurrences };
}

export type WhatsAppSwapStatus = "sent" | "failed" | "no_phone";

export type SwapRecord = {
  id: string;
  assignmentAId: string;
  assignmentBId: string;
  brokerAId: string;
  brokerBId: string;
  brokerAName: string;
  brokerBName: string;
  scheduleAName: string;
  scheduleBName: string;
  dutyDateA: string;
  dutyDateB: string;
  whatsappAStatus: string | null;
  whatsappBStatus: string | null;
  swappedAt: Date;
};

export type SwapNotice = {
  partnerName: string;
  /** Where the broker now on this slot was before the swap. */
  previousDutyDate: string;
  previousScheduleName: string;
  /** WhatsApp to the broker now on this slot. */
  whatsappStatus: string | null;
  swappedAt: string;
};

/**
 * What a slot shows after a swap: "Troca feita com <partner> (antes em <date>)". Only while
 * the slot still holds the broker the swap put there (a later change hides it).
 */
export function swapNoticeFor(record: SwapRecord, assignmentId: string, currentBrokerId: string): SwapNotice | null {
  if (record.assignmentAId === assignmentId && record.brokerBId === currentBrokerId) {
    return { partnerName: record.brokerAName, previousDutyDate: record.dutyDateB, previousScheduleName: record.scheduleBName, whatsappStatus: record.whatsappBStatus, swappedAt: record.swappedAt.toISOString() };
  }
  if (record.assignmentBId === assignmentId && record.brokerAId === currentBrokerId) {
    return { partnerName: record.brokerBName, previousDutyDate: record.dutyDateA, previousScheduleName: record.scheduleAName, whatsappStatus: record.whatsappAStatus, swappedAt: record.swappedAt.toISOString() };
  }
  return null;
}

export function swapNoticeText(notice: Pick<SwapNotice, "partnerName" | "previousDutyDate" | "previousScheduleName">) {
  return `Troca feita com ${notice.partnerName} (antes em ${shortDutyDate(notice.previousDutyDate)}, ${notice.previousScheduleName}).`;
}

export function whatsappStatusLabel(status: string | null) {
  if (status === "sent") return "WhatsApp enviado";
  if (status === "no_phone") return "WhatsApp não enviado (sem telefone)";
  if (status === "failed") return "WhatsApp não enviado";
  return "WhatsApp em envio";
}

/** WhatsApp text to one broker of the swap: his new date, plantão and time. */
export function buildDutySwapWhatsAppMessage(input: {
  brokerName: string | null;
  partnerName: string;
  tenantName: string | null;
  newSlot: { scheduleName: string; dutyDate: string; startsAt: string; endsAt: string };
  previousSlot: { scheduleName: string; dutyDate: string };
}) {
  const firstName = input.brokerName?.trim().split(/\s+/)[0];
  const slot = input.newSlot;
  return [
    `Olá${firstName ? `, ${firstName}` : ""}! A gestão da ${input.tenantName ?? "Âncora Saúde"} fez uma troca na sua escala de plantão: você trocou com ${input.partnerName}.`,
    "",
    `Seu novo plantão: ${slot.scheduleName}, ${longDutyDate(slot.dutyDate)}, das ${slot.startsAt.slice(0, 5)} às ${slot.endsAt.slice(0, 5)}.`,
    `Antes você estava no plantão ${input.previousSlot.scheduleName}, ${longDutyDate(input.previousSlot.dutyDate)}, que agora é de ${input.partnerName}.`,
    "",
    "Se tiver alguma dúvida, fale com a sua gestão.",
  ].join("\n");
}
