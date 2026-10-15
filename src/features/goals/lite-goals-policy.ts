/**
 * Quem pode definir uma meta no Lite (G5). Função pura: o servidor monta os dados do alvo a partir do banco
 * e consulta esta regra. Supervisor: a própria equipe e os próprios corretores. Gestor: a equipe da própria unidade (nunca corretor).
 */

export const LITE_GOAL_TYPES = ["quotes_count", "sla_rate", "response_minutes", "sales_count", "leads_contacted"] as const;
export type LiteGoalType = (typeof LITE_GOAL_TYPES)[number];
export type LiteGoalScope = "team" | "broker";

export type LiteGoalTarget = {
  /** Papel do alvo: supervisor (meta da equipe) ou corretor (meta individual). */
  role: "supervisor" | "broker";
  userId: string;
  status: string;
  branchId: string | null;
  /** Para corretor: o supervisor da equipe. */
  supervisorId: string | null;
};

export function liteGoalTargetAllowed(input: {
  audience: "manager" | "supervisor" | "broker" | null;
  viewerUserId: string;
  viewerBranchId: string | null;
  scope: LiteGoalScope;
  target: LiteGoalTarget;
}): boolean {
  const { audience, viewerUserId, viewerBranchId, scope, target } = input;
  if (target.status !== "active") return false;
  if (audience === "supervisor") {
    if (scope === "team") return target.role === "supervisor" && target.userId === viewerUserId;
    return target.role === "broker" && target.supervisorId === viewerUserId && target.branchId !== null && target.branchId === viewerBranchId;
  }
  if (audience === "manager") {
    if (scope !== "team" || target.role !== "supervisor") return false;
    return viewerBranchId !== null && target.branchId === viewerBranchId;
  }
  return false;
}

/** Período "YYYY-MM" em São Paulo: início no dia 1 e fim no último dia do mês. */
export function periodBounds(period: string): { startDate: string; endDate: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${match[1]}-${match[2]}-01T00:00:00-03:00`,
    endDate: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}T23:59:59-03:00`,
  };
}
