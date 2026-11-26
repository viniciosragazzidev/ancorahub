/**
 * Contadores do menu (25/11/2026): números que pedem ação, ao lado do nome da área, como no DeskComm
 * (docs/research/deskcomm-crm-engenharia-reversa.md, item 2). Somem no zero. Dados puros, sem servidor.
 */
import type { NavAreaId } from "./nav-registry";

export type NavCounts = Partial<Record<NavAreaId, number>>;

/** O que cada número conta, dito por inteiro (leitor de tela e dica do menu). */
export const NAV_COUNTER_LABELS: Partial<Record<NavAreaId, { one: string; many: string }>> = {
  leads: { one: "lead sem primeiro contato", many: "leads sem primeiro contato" },
  distribuicao: { one: "lead esperando corretor", many: "leads esperando corretor" },
  "atendimento-ia": { one: "pergunta da IA esperando a direção", many: "perguntas da IA esperando a direção" },
};

/** Número que aparece no menu: nada no zero, "99+" acima de 99. */
export function formatNavCount(value: number | undefined) {
  if (!value || value <= 0 || !Number.isFinite(value)) return null;
  return value > 99 ? "99+" : String(Math.floor(value));
}

/** Frase do contador ("3 leads esperando corretor"); null sem número. */
export function describeNavCount(areaId: NavAreaId, value: number | undefined) {
  const shown = formatNavCount(value);
  const label = NAV_COUNTER_LABELS[areaId];
  if (!shown || !label) return null;
  return `${shown} ${value === 1 ? label.one : label.many}`;
}

/** Soma dos contadores de várias áreas (cabeça de um grupo recolhido). */
export function sumNavCounts(counts: NavCounts, areaIds: readonly NavAreaId[]) {
  return areaIds.reduce((total, id) => total + (counts[id] ?? 0), 0);
}
