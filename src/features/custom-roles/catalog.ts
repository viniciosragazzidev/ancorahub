import type { PermissionKey } from "@/shared/auth/permissions";

export type CustomRoleScope = "none" | "own" | "branch" | "tenant";
export type CapabilityDefinition = {
  key: PermissionKey;
  label: string;
  description: string;
  category: string;
  delegable: boolean;
  scopes: readonly CustomRoleScope[];
};

const blocked = new Set<PermissionKey>([
  "gerenciar_financeiro", "gerenciar_comissoes", "gerenciar_filiais", "convidar_gestor",
  "gerenciar_configuracoes_unidade", "configurar_white_label", "acessar_roadmap",
]);

const labels: Partial<Record<PermissionKey, [string, string, string]>> = {
  acessar_leads: ["Consultar leads", "Visualizar leads dentro do escopo autorizado.", "Leads"],
  criar_lead_manual: ["Criar lead", "Cadastrar leads manualmente.", "Leads"],
  alterar_status_lead: ["Atualizar atendimento", "Alterar o status de um lead autorizado.", "Leads"],
  acessar_conversas: ["Conversas", "Consultar conversas permitidas.", "Atendimento"],
  acessar_tarefas: ["Tarefas", "Consultar e atualizar tarefas permitidas.", "Atendimento"],
  acessar_clientes: ["Clientes", "Consultar clientes do escopo autorizado.", "Clientes"],
  acessar_financeiro: ["Financeiro", "Acessar os painéis financeiros autorizados.", "Financeiro"],
  ver_fluxo_caixa: ["Fluxo de caixa", "Consultar fluxo de caixa.", "Financeiro"],
  ver_resultado_corretor: ["Resultados", "Consultar resultados comerciais permitidos.", "Financeiro"],
  ver_taxas_custos: ["Taxas e custos", "Consultar custos e taxas.", "Financeiro"],
  ver_relatorios_financeiros: ["Relatórios financeiros", "Consultar relatórios financeiros.", "Financeiro"],
  importar_planilhas: ["Importar planilhas", "Importar fontes de captação autorizadas.", "Marketing"],
  importar_leads_meta: ["Importar Lead Ads", "Importar leads originados na Meta.", "Marketing"],
  ver_importacoes_meta: ["Importações Meta", "Acompanhar importações e seus resultados.", "Marketing"],
  acessar_relatorios: ["Relatórios", "Consultar relatórios liberados.", "Relatórios"],
  exportar_relatorios: ["Exportar relatórios", "Exportar dados autorizados.", "Relatórios"],
  acessar_materiais_divulgacao: ["Materiais", "Consultar materiais comerciais.", "Conteúdo"],
  acessar_ferramentas_vendas: ["Ferramentas de vendas", "Usar ferramentas comerciais permitidas.", "Conteúdo"],
  acessar_notificacoes: ["Notificações", "Acessar alertas próprios.", "Pessoal"],
  acessar_configuracoes_pessoais: ["Configurações pessoais", "Alterar dados e segurança da própria conta.", "Pessoal"],
};

export const capabilityCatalog: CapabilityDefinition[] = (Object.keys(labels) as PermissionKey[]).map((key) => {
  const [label, description, category] = labels[key] ?? [key, "Capacidade operacional.", "Outros"];
  const scopes = key.startsWith("acessar_financeiro") || category === "Financeiro"
    ? ["none", "tenant"] as const
    : category === "Marketing"
      ? ["branch", "tenant"] as const
      : ["own", "branch"] as const;
  return { key, label, description, category, delegable: !blocked.has(key), scopes };
});

export function getAssignableCapabilities(scope: CustomRoleScope) {
  return capabilityCatalog.filter((item) => item.delegable && item.scopes.includes(scope));
}
