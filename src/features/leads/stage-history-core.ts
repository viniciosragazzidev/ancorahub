/** Quem mudou a etapa, para o histórico e o funil (05/11). */
export type StageActorType = "broker" | "supervisor" | "manager" | "director" | "ai" | "rule" | "system";

export function stageActorType(input: { systemActor?: "ai" | "rule" | "system" | null; role: string }): StageActorType {
  if (input.systemActor) return input.systemActor;
  if (input.role === "director" || input.role === "manager" || input.role === "supervisor" || input.role === "broker") return input.role;
  return "system";
}

/**
 * Sair de "Aguardando retorno" não é recuo (o cliente voltou a responder); recuo de verdade é ir para uma
 * etapa anterior ou perder. Usado pela proteção de venda em potencial.
 */
export function isStageRegression(input: { previousStatus: string; newStatus: string; order: Record<string, number> }): boolean {
  if (input.newStatus === "lost") return true;
  if (input.previousStatus === "lost" || input.previousStatus === "awaiting_reply") return false;
  return (input.order[input.newStatus] ?? 0) < (input.order[input.previousStatus] ?? 0);
}
