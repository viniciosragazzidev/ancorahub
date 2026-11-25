/** Filtros da tela /tarefas lidos da URL (puro, compartilhado entre página e testes). */
import { canSeeTeamTasks } from "./task-due-groups";

export type TaskListScope = "minhas" | "equipe";
export type TaskListSituation = "abertas" | "concluidas";

export type TaskListFilters = {
  scope: TaskListScope;
  situation: TaskListSituation;
  /** Só em "Da equipe": um responsável dentro do escopo do papel. */
  assigneeId: string | null;
  page: number;
};

/**
 * Normaliza ?escopo, ?situacao, ?responsavel e ?page. O corretor nunca recebe "Da equipe"; quem vê a equipe começa
 * nela. Responsável só vale em "Da equipe" (em "Minhas" o responsável é o próprio usuário).
 */
export function normalizeTaskListFilters(role: string, params: { escopo?: string; situacao?: string; responsavel?: string; page?: string }): TaskListFilters {
  const team = canSeeTeamTasks(role);
  const scope: TaskListScope = team && params.escopo !== "minhas" ? "equipe" : "minhas";
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  return {
    scope,
    situation: params.situacao === "concluidas" ? "concluidas" : "abertas",
    assigneeId: scope === "equipe" && params.responsavel ? params.responsavel : null,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}
