import { isOutsideManagerScope, MANAGER_DISTRIBUTION_REFUSAL } from "@/features/manager-scope/manager-routes";

export type UnitQueueMode = { id: string; name: string; mode: "automatic" | "manual" };

/**
 * Quem pode trocar a fila entre automática e manual (05/11): o Diretor, qualquer fila; o Gestor, só fila
 * gravada na unidade dele (fila global ou de outra unidade fica fora). Devolve o motivo da recusa ou null.
 */
export function queueModeProblem(input: {
  role: string;
  actorBranchId: string | null;
  queue: { branchId: string | null; status: string } | null;
}): string | null {
  // Gestor fora da distribuição desde 10/11 (versão antiga do gestor).
  if (isOutsideManagerScope(input.role)) return MANAGER_DISTRIBUTION_REFUSAL;
  if (input.role !== "director" && input.role !== "manager") return "Sem permissão para mudar a distribuição da fila.";
  if (!input.queue) return "Fila não encontrada.";
  if (input.queue.status !== "active") return "Ative a fila antes de mudar a distribuição.";
  if (input.role === "manager" && (!input.actorBranchId || input.queue.branchId !== input.actorBranchId)) return "Essa fila não é da sua unidade.";
  return null;
}
