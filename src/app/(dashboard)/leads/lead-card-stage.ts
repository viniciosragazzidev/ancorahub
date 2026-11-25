/**
 * Regras do ⋯ do cartão do kanban Lite (25/11/2026): quem pode mover o lead e para onde vai "Próxima etapa".
 * Segue a máquina de estados (`VALID_TRANSITIONS`), a sugestão de hoje (`SUGGESTED_NEXT_MAP`) e as mesmas travas do
 * servidor: o corretor dono move pelo fluxo dele; diretor e gestor (da unidade) pelo fluxo da gestão, que não grava
 * "Entrei em contato" (pede o relato do corretor) nem "Convertido" (a venda é registrada na ficha).
 */
import { SUGGESTED_NEXT_MAP } from "@/features/leads/components/next-status-suggestion";
import { VALID_TRANSITIONS } from "@/features/leads/lead-status-constants";

/** "owner": changeLeadStatusAction; "management": bulkChangeLeadStatusAction com um lead; "none": sem ação. */
export type StageActor = "owner" | "management" | "none";

export function stageActorFor(
  role: string,
  lead: { status: string; branchId: string | null; corretorId: string | null },
  viewer: { branchId?: string | null } = {},
): StageActor {
  if (role === "director") return "management";
  if (role === "manager") return lead.branchId && lead.branchId === viewer.branchId ? "management" : "none";
  // Em /leads o corretor só vê os leads dele; distribuído ainda pede "Iniciar atendimento" na ficha.
  if (role === "broker") return lead.corretorId && lead.status !== "distributed" ? "owner" : "none";
  return "none";
}

/** "direct": grava na hora; "note": pede o relato do contato; "page": abre a ficha (registrar venda). */
export type NextStageMode = "direct" | "note" | "page";

export function nextStageFor(status: string, actor: StageActor): { status: string; mode: NextStageMode } | null {
  if (actor === "none") return null;
  const next = SUGGESTED_NEXT_MAP[status];
  if (!next || !(VALID_TRANSITIONS[status] ?? []).includes(next)) return null;
  if (next === "converted") return { status: next, mode: "page" };
  if (next === "contacted") return actor === "owner" ? { status: next, mode: "note" } : null;
  return { status: next, mode: "direct" };
}

export function canMarkLost(status: string, actor: StageActor) {
  return actor !== "none" && (VALID_TRANSITIONS[status] ?? []).includes("lost");
}
