/**
 * Minhas ligações (26/11/2026, como no DeskComm): regras puras da tela /tarefas/ligacoes. As ligações são as notas do
 * Call Âncora em `lead_interactions` (metadata.source = call_ancora), lidas em `my-calls.ts`. Aqui ficam o escopo de
 * quem ligou, os filtros da URL, a correção de resultado e o resumo do topo.
 */
import { REPORT_PERIODS, wasAnswered, type CallAncoraReportOutcome, type ReportPeriod } from "./report-rules";

export type MyCallRow = {
  id: string;
  brokerId: string;
  brokerName: string;
  leadId: string;
  leadName: string;
  phoneMasked: string;
  outcome: CallAncoraReportOutcome;
  talkSeconds: number;
  correction: boolean;
  at: string;
};

export type MyCallsSummary = { calls: number; answered: number; talkSeconds: number };

export type MyCallsFilters = { period: ReportPeriod; brokerId: string | null };

/** Quem vê as ligações da equipe: diretor (empresa), gestor (unidade) e supervisor (equipe). */
export function canSeeTeamCalls(role: string) {
  return role === "director" || role === "manager" || role === "supervisor";
}

/** ?periodo (hoje, 7d, 30d; padrão 7 dias) e ?corretor (só para quem vê a equipe). */
export function normalizeMyCallsFilters(role: string, params: { periodo?: string; corretor?: string }): MyCallsFilters {
  const period = params.periodo && params.periodo in REPORT_PERIODS ? params.periodo as ReportPeriod : "7d";
  const brokerId = canSeeTeamCalls(role) && params.corretor ? params.corretor.slice(0, 120) : null;
  return { period, brokerId };
}

/**
 * Escopo de quem ligou. `tenant`: a empresa toda. `users`: só estas pessoas (sempre inclui quem está vendo).
 * Corretor: só ele. Supervisor: os corretores da equipe. Gestor: as pessoas da unidade (sem unidade, só ele).
 */
export type CallerScope = { kind: "tenant" } | { kind: "users"; userIds: string[] };

export function resolveCallerScope(input: { role: string; userId: string; teamIds?: readonly string[] | null; tenantWide?: boolean }): CallerScope {
  if (input.role === "broker" || !canSeeTeamCalls(input.role)) return { kind: "users", userIds: [input.userId] };
  if (input.role === "director" || input.tenantWide) return { kind: "tenant" };
  return { kind: "users", userIds: [...new Set([input.userId, ...(input.teamIds ?? [])])] };
}

/** Filtro por corretor dentro do escopo; um corretor de fora do escopo não abre nada além do próprio escopo. */
export function narrowCallerScope(scope: CallerScope, brokerId: string | null): CallerScope {
  if (!brokerId) return scope;
  if (scope.kind === "tenant" || scope.userIds.includes(brokerId)) return { kind: "users", userIds: [brokerId] };
  return scope;
}

/**
 * Uma correção não é outra ligação: troca o resultado da ligação anterior do mesmo corretor para o mesmo lead.
 * Devolve as ligações efetivas, da mais recente para a mais antiga.
 */
export function effectiveCalls(rows: readonly MyCallRow[]): MyCallRow[] {
  const ordered = [...rows].sort((a, b) => a.at.localeCompare(b.at));
  const byId = new Map<string, MyCallRow>();
  const lastByPair = new Map<string, string>();
  for (const row of ordered) {
    const pair = `${row.brokerId}:${row.leadId}`;
    const previous = row.correction ? lastByPair.get(pair) : undefined;
    if (previous) {
      const original = byId.get(previous)!;
      byId.set(previous, { ...original, outcome: row.outcome });
      continue;
    }
    byId.set(row.id, { ...row, correction: false });
    lastByPair.set(pair, row.id);
  }
  return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at));
}

export function summarizeMyCalls(rows: readonly MyCallRow[]): MyCallsSummary {
  return rows.reduce<MyCallsSummary>((sum, row) => ({
    calls: sum.calls + 1,
    answered: sum.answered + (wasAnswered(row) ? 1 : 0),
    talkSeconds: sum.talkSeconds + Math.max(0, row.talkSeconds),
  }), { calls: 0, answered: 0, talkSeconds: 0 });
}

export type MyCallResult = { key: "answered" | "no_answer" | "voicemail" | "wrong_number"; label: string; detail: string | null };

/** Resultado da linha: atendeu (com ou sem interesse), não atendeu, caixa postal ou número errado. */
export function callResult(row: Pick<MyCallRow, "outcome" | "talkSeconds">): MyCallResult {
  if (row.outcome === "interested") return { key: "answered", label: "Atendeu", detail: "Com interesse" };
  if (row.outcome === "not_interested") return { key: "answered", label: "Atendeu", detail: "Sem interesse" };
  if (row.outcome === "wrong_number") return { key: "wrong_number", label: "Número errado", detail: null };
  if (wasAnswered(row)) return { key: "answered", label: "Atendeu", detail: null };
  if (row.outcome === "voicemail") return { key: "voicemail", label: "Caixa postal", detail: null };
  return { key: "no_answer", label: "Não atendeu", detail: null };
}

/** Duração da ligação: "0:42", "12:05". Sem conversa devolve null e a tela escreve "Sem conversa". */
export function formatCallDuration(seconds: number) {
  if (!seconds || seconds <= 0) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Tempo total do resumo: "45 s", "12 min", "1 h 05 min". */
export function formatTalkTotal(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole} s`;
  const minutes = Math.floor(whole / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
