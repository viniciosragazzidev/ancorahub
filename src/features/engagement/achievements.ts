import type { AchievementEvidence, AchievementKey, JourneyAchievement } from "./journey-types";

const BADGES: { key: AchievementKey; name: string; description: string; metric: keyof AchievementEvidence; target: number; sale?: boolean }[] = [
  { key: "lightning", name: "Raio", description: "10 primeiros contatos em até 5 min", metric: "fastContacts", target: 10 },
  { key: "steady_duty", name: "Plantão firme", description: "5 presenças consecutivas confirmadas", metric: "consecutivePresences", target: 5 },
  { key: "first_sale", name: "Primeira venda", description: "Sua primeira venda aprovada", metric: "approvedSales", target: 1, sale: true },
  { key: "family_protected", name: "Família protegida", description: "Uma venda de plano familiar aprovada", metric: "approvedFamilySales", target: 1, sale: true },
  { key: "business_cared", name: "Empresa cuidada", description: "Uma venda de plano empresarial aprovada", metric: "approvedBusinessSales", target: 1, sale: true },
  { key: "returns_on_time", name: "Retorno em dia", description: "20 retornos feitos no prazo", metric: "onTimeReturns", target: 20 },
  { key: "nobody_waiting", name: "Ninguém esperando", description: "Uma semana inteira sem quebrar o prazo de contato", metric: "fullWeeksWithoutSlaBreach", target: 1 },
  { key: "comeback", name: "Virada", description: "Uma venda aprovada de um lead frio", metric: "approvedColdLeadSales", target: 1, sale: true },
];
/** Online duty has no presence confirmation and must not interrupt this badge. */
export function confirmedPresenceSequence(rows: readonly { date: string; status: string; confirmedBy: string | null }[], today: string): number {
  const dates = new Map<string, boolean>();
  for (const row of rows) {
    if (row.date > today || (row.date === today && row.status === "pending")) continue;
    const confirmed = row.status === "confirmed" && row.confirmedBy === null;
    dates.set(row.date, (dates.get(row.date) ?? true) && confirmed);
  }
  let current = 0, best = 0;
  for (const [, confirmed] of [...dates].sort(([a], [b]) => a.localeCompare(b))) { current = confirmed ? current + 1 : 0; best = Math.max(best, current); }
  return best;
}
export function evaluateAchievements(input: { evidence: AchievementEvidence; salesEnabled: boolean; earned?: Partial<Record<AchievementKey, string>> }): JourneyAchievement[] {
  return BADGES.map((badge) => {
    // Current temperature is not historical evidence. Virada stays off in v1.
    const enabled = badge.key !== "comeback" && (!badge.sale || input.salesEnabled);
    const current = Math.max(0, input.evidence[badge.metric]);
    const earnedAt = input.earned?.[badge.key] ?? null;
    return { key: badge.key, name: badge.name, description: badge.description, current, target: badge.target,
      percentage: Math.min(100, Math.floor(100 * current / badge.target)), enabled,
      earned: Boolean(earnedAt) || (enabled && current >= badge.target), earnedAt };
  });
}
