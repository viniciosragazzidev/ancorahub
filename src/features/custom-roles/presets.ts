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
  jobTitle?: "finance" | "operations";
  permissions: readonly string[];
};

/** Modelos prontos para começar um cargo. Decisões em docs/implementations/active/2026-11-04-cargos-e-permissoes.md. */
export const CARGO_MODELOS: readonly CargoModelo[] = [
  {
    id: "erp-operacoes", name: "Operações ERP", description: "Implantação e importação conferida. Use função Operações e papel Gestor; ajuste o escopo antes de atribuir.",
    scope: "branch", papel: "manager", jobTitle: "operations",
    permissions: [routePermissionKey("erp-implantacoes"), routePermissionKey("erp-importacoes"), "erp_view_operations", "erp_manage_operations", "erp_import_data", "acessar_documentos", "aprovar_documentos", "acessar_configuracoes_pessoais"],
  },
  {
    id: "erp-financeiro-preparacao", name: "Financeiro: preparação", description: "Prepara valores e evidências, sem aprovar. Exige função Financeiro e delegação explícita; não altera o papel de ninguém.",
    scope: "tenant", papel: "broker", jobTitle: "finance",
    permissions: [routePermissionKey("erp-financeiro"), "erp_view_finance", "erp_prepare_finance", "acessar_configuracoes_pessoais"],
  },
  {
    id: "erp-financeiro-aprovacao", name: "Financeiro: aprovação", description: "Confere lançamentos e liquidações preparados por outra pessoa. Exige função Financeiro e delegação explícita.",
    scope: "tenant", papel: "broker", jobTitle: "finance",
    permissions: [routePermissionKey("erp-financeiro"), "erp_view_finance", "erp_approve_finance", "acessar_configuracoes_pessoais"],
  },
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
