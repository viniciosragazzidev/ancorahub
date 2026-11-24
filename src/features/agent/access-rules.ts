/**
 * Quem usa o Agente IA do diretor (24/11). Puro, para testar e para a rota, o layout e a sidebar decidirem igual:
 * - papel diretor (gestor de unidade nunca, desde 10/11);
 * - com cargo personalizado, o cargo precisa da permissão `usar_agente_ia` (cargo só corta: papel ∩ cargo);
 * - o diretor pode desligar o agente de uma pessoa na ficha dela em Equipe (lista por empresa nas configurações).
 */
export function agentOffSettingKey(tenantId: string) {
  return `agent_ia_off_users_${tenantId}`;
}

/** Lista de userIds com o agente desligado, gravada como JSON. Valor ilegível conta como lista vazia. */
export function parseAgentOffList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function withAgentAccess(list: readonly string[], userId: string, enabled: boolean) {
  const rest = list.filter((id) => id !== userId);
  return enabled ? rest : [...rest, userId];
}

export function agentAccessAllowed(input: { role: string; outsideManagerScope: boolean; hasCapability: boolean; offForUser: boolean }) {
  return input.role === "director" && !input.outsideManagerScope && input.hasCapability && !input.offForUser;
}
