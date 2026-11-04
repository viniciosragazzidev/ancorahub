import type { PermissionKey } from "@/shared/auth/permissions";

import { isRoutePermission, routePermissionKey } from "./routes";

/**
 * Telas cujas ações internas ainda checam o papel, não o cargo (04/11, F2): o cargo leva a área inteira ou
 * não leva a tela. Ao cobrir as ações com requireCargoCapability, a tela sai da lista.
 */
export const AREAS_SEM_CORTE_FINO: Record<string, readonly PermissionKey[]> = {
  leads: ["acessar_leads", "criar_lead_manual", "alterar_status_lead", "reabrir_lead_perdido", "leads_view_all"],
  conversas: ["acessar_conversas"],
};

/** Ao marcar uma dessas telas, o editor já leva as permissões da área inteira. */
export function completarAreas(selecionadas: readonly string[]): string[] {
  const resultado = new Set(selecionadas);
  for (const [rota, permissoes] of Object.entries(AREAS_SEM_CORTE_FINO)) {
    if (resultado.has(routePermissionKey(rota))) for (const permission of permissoes) resultado.add(permission);
  }
  return [...resultado];
}

export type CargoModelo = {
  id: string;
  name: string;
  description: string;
  scope: "tenant" | "branch" | "own" | "none";
  /** Papel que a pessoa precisa ter (o cargo só corta o que o papel dá). */
  papel: "director" | "manager" | "supervisor" | "broker";
  permissions: readonly string[];
};

/** Modelos prontos para começar um cargo. Decisões em docs/implementations/active/2026-11-04-cargos-e-permissoes.md. */
export const CARGO_MODELOS: readonly CargoModelo[] = [
  {
    id: "plantoes",
    name: "Plantões",
    description: "Cuida dos plantões e das filas da empresa toda: leads, conversas, equipe, escala e distribuição.",
    scope: "tenant",
    papel: "director",
    permissions: completarAreas([
      ...["leads", "conversas", "equipe", "distribuicao", "plantoes", "minha-fila", "tarefas", "notificacoes"].map(routePermissionKey),
      "leads_assign",
      "leads_reassign",
      "leads_bulk_assign",
      "leads_route_to_unit",
      "lead_queues_view",
      "lead_queues_manage",
      "duty_schedules_manage",
      "distribution_audit_view",
      "acessar_tarefas",
      "acessar_notificacoes",
      "acessar_configuracoes_pessoais",
    ]),
  },
];

/** Telas marcadas no cargo (chaves de rota sem o prefixo), para o resumo "o que essa pessoa vê". */
export function telasDoCargo(permissions: readonly string[]): string[] {
  return permissions.filter(isRoutePermission).map((key) => key.slice("route:".length));
}
