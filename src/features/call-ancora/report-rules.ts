/** Painel do diretor: contas do histórico de ligações do Call Âncora (puro, testável). */

export type CallAncoraReportOutcome = "interested" | "not_interested" | "no_answer" | "voicemail" | "wrong_number";

export type CallAncoraCallRow = {
  id: string;
  brokerId: string;
  brokerName: string;
  leadId: string;
  leadName: string;
  phoneMasked: string;
  outcome: CallAncoraReportOutcome;
  auto: boolean;
  correction: boolean;
  talkSeconds: number;
  causeLabel: string | null;
  assigned: boolean;
  at: string;
};

export type CallAncoraCounts = {
  calls: number;
  answered: number;
  interested: number;
  notInterested: number;
  noAnswer: number;
  voicemail: number;
  wrongNumber: number;
  talkSeconds: number;
};

export type CallAncoraBrokerSummary = CallAncoraCounts & {
  brokerId: string;
  brokerName: string;
  lastCallAt: string;
  /** Sessão aberta agora no Call Âncora (memória do servidor). */
  inSessionNow: boolean;
};

export const REPORT_PERIODS = { today: "Hoje", "7d": "7 dias", "30d": "30 dias" } as const;
export type ReportPeriod = keyof typeof REPORT_PERIODS;

export const OUTCOME_REPORT_LABEL: Record<CallAncoraReportOutcome, string> = {
  interested: "Com interesse",
  not_interested: "Sem interesse",
  no_answer: "Não atendeu",
  voicemail: "Caixa postal",
  wrong_number: "Número errado",
};

/** Atendeu: teve tempo em ligação ou o corretor classificou a conversa (com ou sem interesse). */
export function wasAnswered(row: Pick<CallAncoraCallRow, "talkSeconds" | "outcome">) {
  return row.talkSeconds > 0 || row.outcome === "interested" || row.outcome === "not_interested";
}

export function emptyCounts(): CallAncoraCounts {
  return { calls: 0, answered: 0, interested: 0, notInterested: 0, noAnswer: 0, voicemail: 0, wrongNumber: 0, talkSeconds: 0 };
}

/**
 * Conta as ligações. Correções não são outra ligação: a correção substitui o resultado da
 * ligação anterior do mesmo corretor para o mesmo lead.
 */
export function countCalls(rows: CallAncoraCallRow[]): CallAncoraCounts {
  const latestByCall = new Map<string, CallAncoraCallRow>();
  const ordered = [...rows].sort((a, b) => a.at.localeCompare(b.at));
  const lastOriginalKey = new Map<string, string>();
  for (const row of ordered) {
    const pair = `${row.brokerId}:${row.leadId}`;
    if (row.correction && lastOriginalKey.has(pair)) {
      const key = lastOriginalKey.get(pair)!;
      const original = latestByCall.get(key)!;
      latestByCall.set(key, { ...original, outcome: row.outcome, assigned: original.assigned || row.assigned });
    } else {
      latestByCall.set(row.id, row);
      lastOriginalKey.set(pair, row.id);
    }
  }
  const counts = emptyCounts();
  for (const row of latestByCall.values()) {
    counts.calls += 1;
    counts.talkSeconds += row.talkSeconds;
    if (wasAnswered(row)) counts.answered += 1;
    if (row.outcome === "interested") counts.interested += 1;
    if (row.outcome === "not_interested") counts.notInterested += 1;
    if (row.outcome === "no_answer") counts.noAnswer += 1;
    if (row.outcome === "voicemail") counts.voicemail += 1;
    if (row.outcome === "wrong_number") counts.wrongNumber += 1;
  }
  return counts;
}

/** Corretores do período, do que ligou por último para o primeiro. */
export function summarizeBrokers(rows: CallAncoraCallRow[], inSessionNow: Set<string>): CallAncoraBrokerSummary[] {
  const byBroker = new Map<string, CallAncoraCallRow[]>();
  for (const row of rows) {
    const list = byBroker.get(row.brokerId) ?? [];
    list.push(row);
    byBroker.set(row.brokerId, list);
  }
  const summaries: CallAncoraBrokerSummary[] = [];
  for (const [brokerId, list] of byBroker) {
    const lastCallAt = list.reduce((latest, row) => (row.at > latest ? row.at : latest), list[0].at);
    summaries.push({ brokerId, brokerName: list[0].brokerName, lastCallAt, inSessionNow: inSessionNow.has(brokerId), ...countCalls(list) });
  }
  return summaries.sort((a, b) => b.lastCallAt.localeCompare(a.lastCallAt));
}

/** Início do período em São Paulo (hoje, 7 ou 30 dias). */
export function periodStart(period: ReportPeriod, now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const today = new Date(`${day}T00:00:00-03:00`);
  const days = period === "today" ? 0 : period === "7d" ? 6 : 29;
  return new Date(today.getTime() - days * 24 * 60 * 60_000);
}
