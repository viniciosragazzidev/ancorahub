/**
 * Agenda conectada do corretor (Etapa 6 do plano do modo corretor). Funções puras: agrupar por dia,
 * escolher o destino de cada item e descrever o plantão do dia. Nada aqui decide regra de tarefa,
 * SLA ou permissão; a consulta escopada pela sessão entrega os itens prontos.
 */

const TIME_ZONE = "America/Sao_Paulo";

export type AgendaEntryKind = "retorno" | "tarefa" | "renovacao";

export type AgendaEntry = {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  dueAt: Date | null;
  priority: "low" | "normal" | "urgent";
  kind: AgendaEntryKind;
  /** Cliente vinculado ao lead que o corretor pode abrir (já filtrado pelo escopo de clientes). */
  clientId: string | null;
};

export type AgendaGroupKey = "atrasados" | "hoje" | "amanha" | "proximos" | "sem_prazo";

export type AgendaGroup = { key: AgendaGroupKey; label: string; entries: AgendaEntry[] };

const GROUP_LABELS: Record<AgendaGroupKey, string> = {
  atrasados: "Atrasados",
  hoje: "Hoje",
  amanha: "Amanhã",
  proximos: "Próximos",
  sem_prazo: "Sem prazo",
};

const GROUP_ORDER: AgendaGroupKey[] = ["atrasados", "hoje", "amanha", "proximos", "sem_prazo"];

export const AGENDA_KIND_LABELS: Record<AgendaEntryKind, string> = {
  retorno: "Retorno",
  tarefa: "Tarefa",
  renovacao: "Renovação",
};

/**
 * Tipo do item. Renovação só quando a tarefa nasceu de um lembrete de renovação (vínculo gravado no
 * banco); retorno quando o título é o que os agendamentos de retorno gravam; o resto é tarefa.
 */
export function classifyAgendaKind(title: string, fromRenewalReminder: boolean): AgendaEntryKind {
  if (fromRenewalReminder) return "renovacao";
  return /^retorn/i.test(title.trim()) ? "retorno" : "tarefa";
}

/** yyyy-mm-dd no fuso de São Paulo. */
export function saoPauloDayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(value);
}

function addDays(dayKey: string, amount: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

export function agendaGroupOf(dueAt: Date | null, now: Date): AgendaGroupKey {
  if (!dueAt) return "sem_prazo";
  if (dueAt.getTime() < now.getTime()) return "atrasados";
  const today = saoPauloDayKey(now);
  const day = saoPauloDayKey(dueAt);
  if (day === today) return "hoje";
  if (day === addDays(today, 1)) return "amanha";
  return "proximos";
}

/** Grupos na ordem de leitura, só os que têm itens; dentro de cada um, do prazo mais antigo ao mais novo. */
export function groupAgendaEntries(entries: readonly AgendaEntry[], now: Date): AgendaGroup[] {
  const buckets = new Map<AgendaGroupKey, AgendaEntry[]>();
  for (const entry of entries) {
    const key = agendaGroupOf(entry.dueAt ? new Date(entry.dueAt) : null, now);
    const bucket = buckets.get(key) ?? [];
    bucket.push(entry);
    buckets.set(key, bucket);
  }
  return GROUP_ORDER.flatMap((key) => {
    const bucket = buckets.get(key);
    if (!bucket?.length) return [];
    const sorted = [...bucket].sort((left, right) => {
      const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : 0;
      const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : 0;
      return leftTime - rightTime || left.leadName.localeCompare(right.leadName, "pt-BR") || left.id.localeCompare(right.id);
    });
    return [{ key, label: GROUP_LABELS[key], entries: sorted }];
  });
}

export type AgendaDestination = {
  href: string;
  /** Texto acessível do link principal. */
  label: string;
  /** Com perfil aberto, a conversa do lead continua a um toque. */
  secondary: { href: string; label: string } | null;
};

/** Perfil do cliente quando há cliente vinculado e acessível; senão a conversa do lead. */
export function agendaDestination(entry: Pick<AgendaEntry, "leadId" | "leadName" | "clientId">): AgendaDestination {
  const leadHref = `/leads/${encodeURIComponent(entry.leadId)}`;
  if (entry.clientId) {
    return {
      href: `/clientes/${encodeURIComponent(entry.clientId)}`,
      label: `Abrir perfil de ${entry.leadName}`,
      secondary: { href: leadHref, label: "Conversa" },
    };
  }
  return { href: leadHref, label: `Abrir lead ${entry.leadName}`, secondary: null };
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(value);
}

/** Horário do item dentro do grupo: o grupo já diz o dia de hoje e de amanhã. */
export function formatAgendaEntryWhen(dueAt: Date | null, group: AgendaGroupKey, now: Date) {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  const time = formatTime(date);
  if (group === "hoje" || group === "amanha") return time;
  const today = saoPauloDayKey(now);
  const day = saoPauloDayKey(date);
  if (day === today) return `Hoje, ${time}`;
  if (day === addDays(today, -1)) return `Ontem, ${time}`;
  const dayLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE }).format(date);
  if (group !== "proximos") return `${dayLabel}, ${time}`;
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: TIME_ZONE }).format(date);
  return `${weekday} ${dayLabel}, ${time}`;
}

type DutyLike = {
  active: { scheduleName: string; startsAt: Date; endsAt: Date } | null;
  next: { scheduleName: string; dutyDate: string; startsAt: Date; endsAt: Date } | null;
} | null;

export type AgendaDutyLine = { state: "em_andamento" | "hoje"; title: string; detail: string };

/** Só o plantão de hoje (em andamento ou ainda por começar); a escala completa fica em Plantões. */
export function agendaDutyLine(duty: DutyLike, now: Date): AgendaDutyLine | null {
  if (!duty) return null;
  if (duty.active) {
    return { state: "em_andamento", title: duty.active.scheduleName, detail: `Em andamento até ${formatTime(new Date(duty.active.endsAt))}` };
  }
  if (duty.next && saoPauloDayKey(new Date(duty.next.startsAt)) === saoPauloDayKey(now)) {
    return { state: "hoje", title: duty.next.scheduleName, detail: `Hoje, das ${formatTime(new Date(duty.next.startsAt))} às ${formatTime(new Date(duty.next.endsAt))}` };
  }
  return null;
}
