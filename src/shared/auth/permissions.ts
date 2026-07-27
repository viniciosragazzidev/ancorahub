import type { TenantRole } from "@/shared/db/schema";

export const PERMISSIONS = {
  acessar_conversas: ["broker", "manager", "director"],
  acessar_leads: ["broker", "manager", "director"],
  acessar_tarefas: ["broker", "manager", "director"],
  acessar_cotacoes: ["broker", "manager", "director"],
  acessar_documentos: ["broker", "manager", "director"],
  acessar_clientes: ["broker", "manager", "director"],
  acessar_vendas: ["broker", "manager", "director"],
  acessar_dashboard: ["broker", "manager", "director"],
  acessar_relatorios: ["manager", "director"],
  acessar_catalogo: ["director"],
  acessar_configuracoes: ["broker", "manager", "director"],
  acessar_configuracoes_pessoais: ["broker", "manager", "director"],
  configurar_whatsapp_proprio: ["broker", "manager", "director"],
  acessar_configuracoes_unidade: ["manager", "director"],
  gerenciar_configuracoes_unidade: ["manager", "director"],
  acessar_roadmap: ["director"],
  acessar_guia: ["broker", "manager", "director"],
  acessar_notificacoes: ["broker", "manager", "director"],
  acessar_financeiro: ["broker", "manager", "director"],
  ver_fluxo_caixa: ["manager", "director"],
  ver_resultado_corretor: ["manager", "director"],
  ver_comissionamento: ["director"],
  ver_taxas_custos: ["manager", "director"],
  ver_relatorios_financeiros: ["manager", "director"],
  ver_cronograma_repasses: ["manager", "director"],
  gerenciar_financeiro: ["director"],
  criar_lead_manual: ["broker", "manager", "director"],
  ver_dashboard_equipe: ["manager", "director"],
  ver_dashboard_pessoal: ["broker"],
  convidar_gestor: ["director"],
  convidar_corretor: ["director", "manager"],
  gerenciar_filiais: ["director"],
  ver_painel_integridade: ["manager", "director"],
  ver_comissao_propria: ["broker", "manager", "director"],
  ver_comissao_equipe: ["manager", "director"],
  gerenciar_comissoes: ["director"],
  gerenciar_metas: ["director", "manager"],
  ver_meta_propria: ["broker"],
  ver_meta_equipe: ["manager", "director"],
  exportar_relatorios: ["manager", "director"],
  aprovar_documentos: ["manager", "director"],
  configurar_white_label: ["director"],
  alterar_status_lead: ["broker", "manager", "director"],
  reabrir_lead_perdido: ["manager", "director"],
  leads_view_all: ["director"],
  leads_route_to_unit: ["director", "manager"],
  leads_assign: ["director", "manager"],
  leads_reassign: ["director", "manager"],
  leads_bulk_assign: ["director", "manager"],
  lead_queues_view: ["director", "manager"],
  lead_queues_manage: ["director", "manager"],
  distribution_settings_manage: ["director", "manager"],
  duty_schedules_manage: ["director", "manager"],
  distribution_audit_view: ["director", "manager"],
  ver_perfil_unidade: ["director", "manager", "broker"],
  acessar_materiais_divulgacao: ["broker", "manager", "director"],
  gerenciar_materiais_divulgacao: ["director"],
  importar_planilhas: ["manager", "director"],
  importar_leads_meta: ["director"],
  ver_importacoes_meta: ["director"],
  acessar_ferramentas_vendas: ["broker", "manager", "director"],
} as const satisfies Record<string, readonly TenantRole[]>;

export type PermissionKey = keyof typeof PERMISSIONS;

export type JobTitleCapability = "marketing" | "finance";

export const JOB_TITLE_CAPABILITIES: Record<JobTitleCapability, readonly PermissionKey[]> = {
  marketing: [
    "importar_planilhas",
    "importar_leads_meta",
    "ver_importacoes_meta",
    "acessar_leads",
  ],
  finance: [
    "acessar_financeiro",
    "ver_fluxo_caixa",
    "ver_resultado_corretor",
    "ver_taxas_custos",
    "ver_relatorios_financeiros",
    "ver_cronograma_repasses",
    "exportar_relatorios",
    "ver_comissao_propria",
    "ver_comissao_equipe",
  ],
};

export function hasPermission(role: TenantRole | string | null | undefined, permission: PermissionKey) {
  if (role == null) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function hasCapability(
  role: TenantRole | string | null | undefined,
  permission: PermissionKey,
  jobTitle?: string | null,
): boolean {
  if (hasPermission(role, permission)) return true;
  if (jobTitle && jobTitle in JOB_TITLE_CAPABILITIES) {
    const extras = JOB_TITLE_CAPABILITIES[jobTitle as JobTitleCapability];
    return extras.includes(permission);
  }
  return false;
}
