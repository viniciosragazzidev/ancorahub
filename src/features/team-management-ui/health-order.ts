import type { HealthBand, TeamHealthCard } from "./types";

/** Ordem da seção "Saúde das equipes": Crítico primeiro, Excelente por último, sem métrica por último de tudo. */
const BAND_RANK: Record<HealthBand | "semMetrica", number> = { critico: 0, atencao: 1, saudavel: 2, excelente: 3, semMetrica: 4 };

export const BAND_LABELS: Record<HealthBand, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  saudavel: "Saudável",
  excelente: "Excelente",
};

export function sortTeamsByHealth(teams: readonly TeamHealthCard[]): TeamHealthCard[] {
  return [...teams].sort((a, b) => {
    const byBand = BAND_RANK[a.band ?? "semMetrica"] - BAND_RANK[b.band ?? "semMetrica"];
    if (byBand !== 0) return byBand;
    return a.teamName.localeCompare(b.teamName, "pt-BR");
  });
}

/** Equipes que pedem ação do gestor: faixa Crítico ou Atenção. Sem métrica não conta. */
export function countTeamsNeedingAttention(teams: readonly TeamHealthCard[]): number {
  return teams.filter((team) => team.band === "critico" || team.band === "atencao").length;
}

/** Frase de exceção do topo. Sem métrica nunca diz "em dia": não sabemos. */
export function exceptionPhrase(teamsNeedingAttention: number, metricsAvailable: boolean): string {
  if (!metricsAvailable) return "Indicadores de saúde chegam em breve.";
  if (teamsNeedingAttention === 0) return "Todas as equipes em dia";
  if (teamsNeedingAttention === 1) return "1 equipe precisa de atenção";
  return `${teamsNeedingAttention} equipes precisam de atenção`;
}

/** Comparação entre supervisores: maior score primeiro, sem score por último, depois por nome. Sem pódio. */
export function sortSupervisorsForComparison<T extends { score: number | null; name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.score !== b.score) {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
