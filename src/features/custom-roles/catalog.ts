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
  "gerenciar_financeiro",
  "gerenciar_comissoes",
  "gerenciar_filiais",
  "convidar_gestor",
  "gerenciar_configuracoes_unidade",
  "configurar_white_label",
  "acessar_roadmap",
]);

const labels: Record<PermissionKey, [string, string, string]> = {
  // Comercial & Leads
  acessar_leads: ["Consultar leads", "Visualizar leads dentro do escopo de abrangência.", "Comercial & Leads"],
  criar_lead_manual: ["Criar lead manual", "Cadastrar leads no sistema de forma manual.", "Comercial & Leads"],
  alterar_status_lead: ["Alterar status do lead", "Atualizar o status e o estágio do lead.", "Comercial & Leads"],
  reabrir_lead_perdido: ["Reabrir lead perdido", "Reativar leads arquivados como perdidos.", "Comercial & Leads"],
  leads_view_all: ["Visualizar todos os leads", "Acesso total de leitura de leads da empresa.", "Comercial & Leads"],

  // Distribuição & Filas
  leads_route_to_unit: ["Roteamento para unidade", "Direcionar leads diretamente para unidades específicas.", "Distribuição & Filas"],
  leads_assign: ["Atribuir leads", "Vincular um lead a um corretor específico.", "Distribuição & Filas"],
  leads_reassign: ["Reatribuir leads", "Trocar o corretor responsável por um lead.", "Distribuição & Filas"],
  leads_bulk_assign: ["Atribuição em lote", "Vincular múltiplos leads a corretores de uma só vez.", "Distribuição & Filas"],
  lead_queues_view: ["Visualizar filas de leads", "Acompanhar as filas de distribuição de leads.", "Distribuição & Filas"],
  lead_queues_manage: ["Gerenciar filas de leads", "Configurar e pausar filas de distribuição.", "Distribuição & Filas"],
  distribution_settings_manage: ["Configurar regras de distribuição", "Ajustar regras, pesos e SLA de distribuição.", "Distribuição & Filas"],
  duty_schedules_manage: ["Gerenciar plantões", "Configurar a escala de plantonistas das unidades.", "Distribuição & Filas"],
  distribution_audit_view: ["Auditoria de distribuição", "Ver log de auditoria de como cada lead foi entregue.", "Distribuição & Filas"],

  // Atendimento & Clientes
  acessar_conversas: ["Acessar conversas", "Visualizar conversas com clientes (chat integrado).", "Atendimento & Clientes"],
  acessar_tarefas: ["Acessar tarefas", "Ver e marcar como concluídas as tarefas comerciais.", "Atendimento & Clientes"],
  acessar_clientes: ["Acessar clientes", "Consultar a base histórica de clientes.", "Atendimento & Clientes"],
  acessar_cotacoes: ["Acessar cotações", "Visualizar e gerar simulações e cotações.", "Atendimento & Clientes"],
  acessar_documentos: ["Acessar documentos", "Visualizar documentos enviados pelos clientes.", "Atendimento & Clientes"],
  aprovar_documentos: ["Aprovar documentos", "Validar e aprovar documentos recebidos.", "Atendimento & Clientes"],

  // Vendas & Desempenho
  acessar_vendas: ["Acessar painel de vendas", "Consultar o registro de fechamentos e contratos.", "Vendas & Desempenho"],
  acessar_dashboard: ["Acessar painel geral", "Visualizar os principais gráficos e resumos.", "Vendas & Desempenho"],
  ver_dashboard_equipe: ["Dashboard da equipe", "Ver indicadores agregados de desempenho do time.", "Vendas & Desempenho"],
  ver_dashboard_pessoal: ["Dashboard pessoal", "Visualizar apenas as próprias metas e conversões.", "Vendas & Desempenho"],
  acessar_catalogo: ["Acessar catálogo", "Consultar produtos e planos disponíveis no sistema.", "Vendas & Desempenho"],
  acessar_ferramentas_vendas: ["Ferramentas de vendas", "Utilizar as ferramentas auxiliares de vendas.", "Vendas & Desempenho"],

  // Marketing & Materiais
  acessar_materiais_divulgacao: ["Acessar materiais de marketing", "Visualizar e baixar criativos e textos comerciais.", "Marketing & Materiais"],
  gerenciar_materiais_divulgacao: ["Gerenciar materiais de marketing", "Fazer upload e organizar novos criativos.", "Marketing & Materiais"],
  importar_planilhas: ["Importar planilhas", "Importar contatos de arquivos CSV ou Excel.", "Marketing & Materiais"],
  importar_leads_meta: ["Importar leads (Meta Ads)", "Acessar o sincronizador de Lead Ads do Facebook.", "Marketing & Materiais"],
  ver_importacoes_meta: ["Histórico de importações", "Visualizar logs de leads importados via integrações.", "Marketing & Materiais"],
  acessar_campanhas_meta: ["Ver campanhas Meta", "Acompanhar status das campanhas integradas.", "Marketing & Materiais"],
  acessar_integracao_meta: ["Gerenciar integração Meta", "Conectar e desconectar contas de anúncios.", "Marketing & Materiais"],

  // Financeiro & Comissões
  acessar_financeiro: ["Acessar painel financeiro", "Visualizar a aba de faturamento da empresa.", "Financeiro & Comissões"],
  ver_fluxo_caixa: ["Ver fluxo de caixa", "Consultar entradas e saídas financeiras da unidade.", "Financeiro & Comissões"],
  ver_resultado_corretor: ["Ver resultado por corretor", "Consultar faturamento individual de corretores.", "Financeiro & Comissões"],
  ver_comissionamento: ["Ver comissionamentos", "Consultar valores e regras de comissão.", "Financeiro & Comissões"],
  ver_taxas_custos: ["Ver taxas e custos", "Visualizar descontos, impostos e custos operacionais.", "Financeiro & Comissões"],
  ver_relatorios_financeiros: ["Relatórios financeiros", "Acessar balanços consolidados de faturamento.", "Financeiro & Comissões"],
  ver_cronograma_repasses: ["Cronograma de repasses", "Acompanhar datas de pagamento de comissões.", "Financeiro & Comissões"],
  ver_comissao_propria: ["Ver comissão própria", "Visualizar a comissão devida aos seus próprios negócios.", "Financeiro & Comissões"],
  ver_comissao_equipe: ["Ver comissão da equipe", "Consultar comissões geradas por membros da unidade.", "Financeiro & Comissões"],

  // Relatórios
  acessar_relatorios: ["Acessar relatórios", "Visualizar relatórios gerenciais.", "Relatórios"],
  exportar_relatorios: ["Exportar relatórios gerenciais", "Baixar planilhas e PDFs com dados consolidados.", "Relatórios"],
  exportar_relatorios_operacionais: ["Exportar relatórios operacionais", "Baixar relatórios de leads e atendimentos.", "Relatórios"],

  // Configurações & Pessoal
  acessar_configuracoes: ["Acessar configurações da empresa", "Visualizar as abas de parametrização.", "Configurações & Pessoal"],
  acessar_configuracoes_pessoais: ["Configurações pessoais", "Ajustar preferências de perfil e senha.", "Configurações & Pessoal"],
  configurar_whatsapp_proprio: ["Conectar WhatsApp pessoal", "Conectar número de atendimento individual via WAHA.", "Configurações & Pessoal"],
  acessar_guia: ["Acessar guia de uso", "Acessar materiais de ajuda e onboarding.", "Configurações & Pessoal"],
  acessar_notificacoes: ["Notificações de sistema", "Receber alertas no painel e e-mail.", "Configurações & Pessoal"],
  convidar_corretor: ["Convidar corretor", "Criar links de convite para novos corretores.", "Configurações & Pessoal"],
  ver_painel_integridade: ["Painel de integridade (NOC)", "Monitorar status das integrações e canais.", "Configurações & Pessoal"],
  ver_perfil_unidade: ["Ver perfil da unidade", "Visualizar informações da filial associada.", "Configurações & Pessoal"],
  acessar_qualificacao_ia: ["Central de Qualificação IA", "Configurar e monitorar o agente de qualificação por IA.", "Configurações & Pessoal"],
  gerenciar_metas: ["Gerenciar metas comerciais", "Definir metas de faturamento e leads para o time.", "Configurações & Pessoal"],
  ver_meta_propria: ["Ver meta pessoal", "Acompanhar a sua própria barra de progresso de meta.", "Configurações & Pessoal"],
  ver_meta_equipe: ["Ver meta da equipe", "Acompanhar a evolução das metas de toda a filial.", "Configurações & Pessoal"],

  // Bloqueadas (apenas para referência)
  gerenciar_financeiro: ["Gerenciar Financeiro", "Acesso total de escrita a repasses e configurações financeiras.", "Financeiro & Comissões"],
  gerenciar_comissoes: ["Gerenciar Comissões", "Alterar regras de comissão.", "Financeiro & Comissões"],
  gerenciar_filiais: ["Gerenciar Unidades", "Criar, editar e arquivar filiais da empresa.", "Configurações & Pessoal"],
  convidar_gestor: ["Convidar Gestores", "Criar acessos de Gestor e Diretor.", "Configurações & Pessoal"],
  gerenciar_configuracoes_unidade: ["Configurações da Unidade", "Alterar informações corporativas das filiais.", "Configurações & Pessoal"],
  configurar_white_label: ["Personalização de Marca", "Alterar logotipo, cores e domínio.", "Configurações & Pessoal"],
  acessar_roadmap: ["Acessar Roadmap", "Visualizar calendário de atualizações do produto.", "Configurações & Pessoal"],
};

export const capabilityCatalog: CapabilityDefinition[] = (Object.keys(labels) as PermissionKey[]).map((key) => {
  const [label, description, category] = labels[key];
  const scopes =
    category === "Financeiro & Comissões" || category === "Relatórios"
      ? (["none", "branch", "tenant"] as const)
      : category === "Marketing & Materiais" || category === "Distribuição & Filas"
        ? (["branch", "tenant"] as const)
        : (["own", "branch", "tenant"] as const);

  return { key, label, description, category, delegable: !blocked.has(key), scopes };
});

export function getAssignableCapabilities(scope: CustomRoleScope) {
  return capabilityCatalog.filter((item) => item.delegable && item.scopes.includes(scope));
}
