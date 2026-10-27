import type { LiveRole, LiveStatusId } from "./types";

/** Ordem da faixa: o que o sistema faz sozinho primeiro, o que pede gente depois. */
export const LIVE_STATUS_ORDER: readonly LiveStatusId[] = [
  "frios",
  "frios-recuperados",
  "qualificacao-ia",
  "aguardando-corretor",
  "ofertas",
  "primeiro-contato",
  "plantao",
  "whatsapp-fila",
];

/**
 * Quem vê cada status (decisões do Vinicios, 27/10, e o que cada papel já vê hoje):
 * - frios, recuperação de frios, qualificação pela IA e aguardando corretor: leads ainda sem corretor. Só diretor e gestor
 *   enxergam esses leads hoje (a Distribuição é deles; o supervisor só vê leads da equipe).
 * - fila do WhatsApp e o selo do motor: diretor e gestor (decisão 3).
 * - ofertas, primeiro contato e plantão: todos; o supervisor vê a equipe e o corretor só o dele.
 */
const ROLES: Record<LiveStatusId, readonly LiveRole[]> = {
  frios: ["director", "manager"],
  "frios-recuperados": ["director", "manager"],
  "qualificacao-ia": ["director", "manager"],
  "aguardando-corretor": ["director", "manager"],
  ofertas: ["director", "manager", "supervisor", "broker"],
  "primeiro-contato": ["director", "manager", "supervisor", "broker"],
  plantao: ["director", "manager", "supervisor", "broker"],
  "whatsapp-fila": ["director", "manager"],
};

export function visibleStatusIds(role: LiveRole): LiveStatusId[] {
  return LIVE_STATUS_ORDER.filter((id) => ROLES[id].includes(role));
}

export function canSeeDistributionEngineSeal(role: LiveRole) {
  return role === "director" || role === "manager";
}

export function isLiveStatusId(value: string): value is LiveStatusId {
  return (LIVE_STATUS_ORDER as readonly string[]).includes(value);
}
