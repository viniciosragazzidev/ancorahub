/**
 * Cadastro único da navegação do modo normal (e do diretor): áreas do menu lateral e as abas de cada área.
 * Cada funcionalidade mora em uma área só (docs/implementations/active/2026-11-04-organizacao-de-rotas.md).
 * Dados puros: o menu lateral, as abas da área e os títulos do diretor leem daqui.
 */
import type { PermissionKey } from "@/shared/auth/permissions";
import type { TenantRole } from "@/shared/db/schema";
import { canShowNavigationItem, type NavigationAccessUser } from "@/shared/navigation-access";

export type NavAreaId = "inicio" | "conversas" | "leads" | "distribuicao" | "comercial" | "financeiro" | "erp" | "equipe" | "atendimento-ia" | "marketing" | "configuracoes";

export type NavSection = "Principal" | "Operação" | "Crescimento" | "Sistema";

export type NavTab = {
  id: string;
  label: string;
  /** Para que serve a tela, em uma linha: subtítulo da busca Ctrl+K e cartão do hub. */
  description: string;
  href: string;
  permission: PermissionKey;
  /** Outros caminhos que pertencem a esta aba (o próprio href já conta). Prefixo: "/x" vale para "/x" e "/x/...". */
  paths?: readonly string[];
  /** Só estes papéis enxergam a aba (a página também barra os outros). */
  roles?: readonly TenantRole[];
  /** Escondida enquanto a chave correspondente estiver desligada. */
  requires?: "negotiations" | "relationshipCenter" | "postSaleAudit" | "autoSale" | "erp";
  /**
   * Rota cuja permissão vale para a aba quando o href é outro endereço (ex.: Comissões abre em /settings?tab=comissoes,
   * mas quem pode ver é quem pode abrir /configuracoes/comissoes). Sem isto, a permissão segue o href.
   */
  accessPath?: string;
  /** Outros valores de query que abrem a mesma aba (links antigos), ex.: { tab: ["alerts"] }. */
  aliases?: Readonly<Record<string, readonly string[]>>;
  /**
   * A página troca esta visão sozinha pela query (componente de cliente lendo a URL): a aba muda só a URL,
   * sem ida ao servidor. Sem isso, a aba navega normalmente e a página renderiza de novo no servidor.
   */
  inPlace?: boolean;
  /** A mesma página também responde nestes endereços (ex.: /leads/distribuicao é /distribuicao). */
  alsoAt?: readonly string[];
  /**
   * Quem tem cargo só vê a aba com esta capacidade (mesma regra da página, DISTRIBUTION_VIEW_CAPABILITY).
   * Sem cargo vale só o papel, como antes.
   */
  cargoCapability?: string;
  /** Só para quem não tem cargo (a página recusa quem tem, ex.: /equipe/cargos). */
  noCargo?: boolean;
  /**
   * Mora no hub da área (ex.: /ia): fica fora da fileira de abas do topo, mas continua dona do endereço (título,
   * busca Ctrl+K e permissão seguem valendo). Aberta, aparece no fim da fileira para a pessoa saber onde está.
   */
  hub?: boolean;
};

export type NavArea = {
  id: NavAreaId;
  label: string;
  fullLabel: string;
  section: NavSection;
  tabs: readonly NavTab[];
};

export const NAV_AREAS: readonly NavArea[] = [
  {
    id: "inicio",
    label: "Início",
    fullLabel: "Painel e indicadores",
    section: "Principal",
    tabs: [
      { id: "painel", label: "Painel", description: "Números do dia, da equipe e do funil", href: "/dashboard", permission: "acessar_dashboard", paths: ["/dashboard", "/relatorios"] },
      { id: "ao-vivo", label: "Ao vivo", description: "Quem está atendendo agora e o que está parado", href: "/noc", permission: "acessar_dashboard", roles: ["director", "manager", "supervisor"] },
    ],
  },
  {
    id: "conversas",
    label: "Conversas",
    fullLabel: "Atendimento e WhatsApp",
    section: "Principal",
    tabs: [
      { id: "conversas", label: "Conversas", description: "Conversas do WhatsApp com leads e clientes", href: "/conversas", permission: "acessar_conversas", paths: ["/conversas", "/mensagens"] },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    fullLabel: "Leads e oportunidades",
    section: "Principal",
    tabs: [
      { id: "leads", label: "Leads", description: "Todos os leads, por etapa, fila e corretor", href: "/leads", permission: "acessar_leads" },
      { id: "arquivados", label: "Arquivados", description: "Leads arquivados, para consultar ou reativar", href: "/leads/arquivados", permission: "acessar_leads", roles: ["director"] },
      // Tarefas por prazo (25/11, DeskComm §7.2): Minhas e Da equipe. O antigo /tarefas/dashboard fica sob esta aba.
      { id: "tarefas", label: "Tarefas", description: "Retornos e tarefas por prazo, suas e da equipe", href: "/tarefas", permission: "acessar_tarefas" },
    ],
  },
  {
    id: "distribuicao",
    label: "Distribuição",
    fullLabel: "Distribuição de leads, plantões e regras",
    section: "Operação",
    tabs: [
      { id: "hoje", label: "Resumo", description: "Como os leads de hoje estão sendo distribuídos", href: "/distribuicao", permission: "acessar_qualificacao_ia", roles: ["director", "manager"], paths: ["/distribuicao", "/leads/distribuicao"], cargoCapability: "lead_queues_view" },
      { id: "regras", label: "Entradas e regras", description: "De onde os leads chegam e para quem vão", href: "/distribuicao?view=roteamento", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director", "manager"], cargoCapability: "distribution_settings_manage" },
      { id: "filas", label: "Filas", description: "Filas de leads esperando corretor", href: "/distribuicao?view=filas", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director"], cargoCapability: "lead_queues_view" },
      { id: "plantoes", label: "Plantões", description: "Escala dos plantões e quem confirmou presença", href: "/distribuicao?view=plantao", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director", "manager"], paths: ["/leads/distribuicao/plantao"], cargoCapability: "duty_schedules_manage" },
      { id: "saude", label: "Saúde", description: "Histórico da distribuição e o que falhou", href: "/distribuicao?view=saude_historico", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director", "manager"], aliases: { view: ["saude", "historico"] }, cargoCapability: "distribution_audit_view" },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    fullLabel: "Negociações, propostas, vendas e clientes",
    section: "Operação",
    tabs: [
      { id: "vendas", label: "Vendas", description: "Vendas registradas e em andamento", href: "/vendas", permission: "acessar_vendas" },
      // /propostas redireciona para /vendas?tab=propostas (next.config.ts): a aba aponta para o destino final (20/11).
      { id: "propostas", label: "Propostas", description: "Propostas enviadas e o que o cliente respondeu", href: "/vendas?tab=propostas", permission: "acessar_vendas", paths: ["/propostas"], accessPath: "/propostas" },
      { id: "negociacoes", label: "Negociações", description: "Negociações abertas com cada cliente", href: "/negociacoes", permission: "ver_dashboard_equipe", requires: "negotiations" },
      // Venda Automatizada (piloto, DEC-182): só com feature_auto_sale_<tenantId> ligada.
      { id: "venda-automatizada", label: "Venda Automatizada", description: "Vendas que o sistema conduz sozinho", href: "/vendas/automatizada", permission: "acessar_vendas", roles: ["director", "manager"], requires: "autoSale" },
      { id: "clientes", label: "Clientes", description: "Clientes que compraram, com contratos e renovações", href: "/clientes", permission: "acessar_clientes" },
      { id: "documentos", label: "Documentos", description: "Documentos dos clientes e das vendas", href: "/documentos", permission: "acessar_documentos" },
      { id: "comissoes", label: "Comissões", description: "Regras de comissão por operadora e plano", href: "/settings?tab=comissoes", permission: "ver_comissionamento", roles: ["director", "manager"], paths: ["/configuracoes/comissoes"], accessPath: "/configuracoes/comissoes" },
      { id: "ferramentas", label: "Ferramentas", description: "Validador de comprovante e outras ferramentas de venda", href: "/ferramentas", permission: "acessar_ferramentas", paths: ["/ferramentas/validador-comprovante"] },
    ],
  },
  {
    // ERP: o Financeiro é uma área própria (as seções são as abas), para nunca empilhar duas fileiras de abas.
    id: "financeiro", label: "Financeiro", fullLabel: "Lançamentos, comissões, repasses e fechamento", section: "Operação",
    tabs: [
      { id: "lancamentos", label: "Lançamentos", description: "Entradas e saídas registradas", href: "/financeiro", permission: "erp_view_finance", requires: "erp", paths: ["/financeiro/lancamentos"] },
      { id: "conciliacao", label: "Conciliação", description: "Conferir o extrato com os lançamentos", href: "/financeiro/conciliacao", permission: "acessar_financeiro", requires: "erp" },
      { id: "recebiveis", label: "Recebíveis", description: "O que as operadoras ainda vão pagar", href: "/financeiro/recebiveis", permission: "acessar_financeiro", requires: "erp" },
      { id: "despesas", label: "Despesas", description: "Despesas da corretora", href: "/financeiro/despesas", permission: "acessar_financeiro", requires: "erp" },
      { id: "comissoes", label: "Comissões", description: "Comissões a receber e já recebidas", href: "/financeiro/comissoes", permission: "ver_comissao_propria", requires: "erp" },
      { id: "repasses", label: "Repasses", description: "Repasses de comissão para os corretores", href: "/financeiro/repasses", permission: "ver_comissao_propria", requires: "erp" },
      { id: "recibos", label: "Recibos", description: "Recibos emitidos para os corretores", href: "/financeiro/recibos", permission: "ver_comissao_propria", requires: "erp" },
      { id: "adiantamentos", label: "Adiantamentos", description: "Adiantamentos feitos aos corretores", href: "/financeiro/adiantamentos", permission: "erp_view_finance", requires: "erp" },
      { id: "caixa", label: "Caixa", description: "Saldo e fluxo de caixa por período", href: "/financeiro/fluxo-caixa", permission: "erp_view_finance", requires: "erp" },
      { id: "fechamentos", label: "Fechamentos", description: "Fechamento do mês e conferência final", href: "/financeiro/fechamentos", permission: "erp_view_finance", requires: "erp" },
    ],
  },
  {
    id: "erp", label: "Operação ERP", fullLabel: "Implantação, indicações, metas e inteligência", section: "Operação",
    tabs: [
      { id: "implantacao", label: "Implantação", description: "Contratos em implantação na operadora", href: "/implantacoes", permission: "erp_view_operations", requires: "erp" },
      { id: "indicacoes", label: "Indicações", description: "Indicações recebidas e o que virou venda", href: "/indicacoes", permission: "erp_manage_referrals", requires: "erp" },
      { id: "metas", label: "Metas", description: "Metas da equipe e de cada corretor", href: "/metas", permission: "erp_view_analytics", requires: "erp" },
      { id: "inteligencia", label: "Inteligência", description: "Produção por operadora, crescimento e diário", href: "/relatorios/producao", permission: "erp_view_analytics", requires: "erp", paths: ["/relatorios/operadoras", "/relatorios/crescimento", "/relatorios/diario"] },
      { id: "incentivos", label: "Incentivos", description: "Campanhas de incentivo para a equipe", href: "/campanhas-incentivo", permission: "erp_view_analytics", requires: "erp" },
      { id: "tv", label: "Modo TV", description: "Placar para a TV da sala", href: "/tv", permission: "erp_view_analytics", requires: "erp" },
      { id: "importacoes", label: "Importações", description: "Importar planilhas de vendas e contratos", href: "/administracao/importacoes", permission: "erp_import_data", requires: "erp" },
      { id: "governanca", label: "Módulos", description: "Ligar e desligar módulos do ERP", href: "/administracao/erp", permission: "erp_manage_modules", requires: "erp", roles: ["director"], noCargo: true },
    ],
  },
  {
    id: "equipe",
    label: "Equipe",
    fullLabel: "Equipe, unidades e relacionamento",
    section: "Operação",
    tabs: [
      { id: "pessoas", label: "Pessoas", description: "Corretores, gestores, unidades e convites", href: "/equipe", permission: "convidar_corretor", paths: ["/equipe", "/equipe/convidar", "/filiais", "/unidades"] },
      { id: "plantoes-unidade", label: "Plantões da unidade", description: "Plantões dos corretores da sua unidade", href: "/equipe/plantoes", permission: "convidar_corretor", roles: ["manager"], paths: ["/plantoes/corretor"] },
      { id: "relacionamento", label: "Relacionamento", description: "Acompanhamento e conversas com o time", href: "/relacionamento", permission: "convidar_corretor", requires: "relationshipCenter" },
      { id: "pos-venda", label: "Pós-venda", description: "Auditoria do pós-venda por corretor", href: "/equipe/pos-venda", permission: "acessar_leads", roles: ["director", "manager"], requires: "postSaleAudit" },
    ],
  },
  {
    id: "atendimento-ia",
    label: "Atendimento IA",
    fullLabel: "Qualificação por IA, roteiros e mensagens",
    section: "Crescimento",
    tabs: [
      // 25/11/2026: a fileira do topo mostra só o dia a dia (Início, Leads na qualificação, Alertas, Execuções).
      // As demais (hub: true) abrem pelo hub /ia e continuam donas dos seus endereços.
      { id: "inicio", label: "Início", description: "Resumo da IA e atalhos para cada ajuste", href: "/ia", permission: "acessar_qualificacao_ia" },
      { id: "leads-qualificacao", label: "Leads na qualificação", description: "Leads que a IA está qualificando agora", href: "/qualificacao/leads", permission: "acessar_qualificacao_ia" },
      { id: "alertas", label: "Alertas", description: "O que a IA não conseguiu resolver sozinha", href: "/ia/alertas", permission: "acessar_qualificacao_ia" },
      { id: "execucoes", label: "Execuções", description: "Cada resposta da IA e por que ela agiu assim", href: "/ia/execucoes", permission: "acessar_qualificacao_ia" },
      // 26/11/2026: o que a IA não soube responder ao lead espera a resposta da direção aqui (contador no menu).
      { id: "perguntas-direcao", label: "Perguntas para a direção", description: "O que a IA não soube responder ao lead, para você responder e ensinar", href: "/ia/perguntas", permission: "acessar_qualificacao_ia", roles: ["director"] },
      { id: "comportamento", label: "Prompt e comportamento", description: "O prompt e o jeito de a IA conversar", href: "/qualificacao", permission: "acessar_qualificacao_ia", inPlace: true, hub: true },
      { id: "permissoes", label: "Permissões", description: "O que a IA pode fazer sem perguntar", href: "/qualificacao?tab=agent_triggers", permission: "acessar_qualificacao_ia", inPlace: true, aliases: { tab: ["mcp_governance"] }, hub: true },
      { id: "follow-up", label: "Follow-up", description: "Quando a IA volta a chamar quem parou de responder", href: "/qualificacao?tab=followup_rules", permission: "acessar_qualificacao_ia", inPlace: true, hub: true },
      { id: "conectividade", label: "Conectividade", description: "Se o WhatsApp da IA está conectado", href: "/qualificacao?tab=whatsapp_diag", permission: "acessar_qualificacao_ia", inPlace: true, hub: true },
      { id: "simulador", label: "Simulador", description: "Testar a IA antes de valer para os leads", href: "/qualificacao?tab=simulator", permission: "acessar_qualificacao_ia", inPlace: true, aliases: { tab: ["alerts"] }, hub: true },
      { id: "turbo", label: "Qualificação turbo", description: "Qualificação mais rápida para leads quentes", href: "/qualificacao/turbo", permission: "acessar_qualificacao_ia", hub: true },
      { id: "recuperacao", label: "Recuperação", description: "Leads parados que a IA tenta reativar", href: "/qualificacao/recuperacao", permission: "acessar_qualificacao_ia", hub: true },
      { id: "situacoes", label: "Situações", description: "Situações de atendimento e o que fazer em cada uma", href: "/atendimento/situacoes", permission: "acessar_qualificacao_ia", paths: ["/atendimento"], hub: true },
      { id: "mensagens", label: "Mensagens", description: "Mensagens prontas que a IA e a equipe usam", href: "/atendimento/mensagens", permission: "acessar_qualificacao_ia", hub: true },
      { id: "perguntas", label: "Fluxo de atendimento", description: "As perguntas da qualificação e a ordem delas", href: "/atendimento/fluxo", permission: "acessar_qualificacao_ia", hub: true },
      { id: "fluxos", label: "Fluxos de WhatsApp", description: "Fluxos automáticos de mensagens no WhatsApp", href: "/fluxos-whatsapp", permission: "acessar_qualificacao_ia", roles: ["director"], hub: true },
      { id: "base", label: "Materiais das operadoras", description: "Material de cada operadora que a IA consulta", href: "/ferramentas/materiais-operadoras", permission: "acessar_ferramentas", roles: ["director"], hub: true },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    fullLabel: "Campanhas e importação de leads",
    section: "Crescimento",
    tabs: [
      { id: "campanhas", label: "Campanhas", description: "Campanhas da Meta e os leads que trouxeram", href: "/marketing/campanhas", permission: "acessar_campanhas_meta", paths: ["/marketing"] },
      { id: "importacoes", label: "Importações", description: "Importar listas de leads", href: "/marketing/importacoes", permission: "importar_leads_meta" },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    fullLabel: "Conta, empresa, canais e acesso",
    section: "Sistema",
    tabs: [
      { id: "ajustes", label: "Ajustes", description: "Sua conta, empresa e preferências", href: "/settings", permission: "acessar_configuracoes_pessoais", paths: ["/settings", "/settings/extension", "/settings/feedback-templates", "/settings/resultado-plantao", "/extensao", "/extensao/conectar"] },
      { id: "whatsapp", label: "WhatsApp", description: "Números de WhatsApp conectados", href: "/integrations/whatsapp", permission: "acessar_configuracoes_pessoais" },
      { id: "integracoes", label: "Integrações", description: "Meta, webhooks e outras integrações", href: "/integrations", permission: "acessar_integracao_meta", paths: ["/integrations/meta", "/guia/webhook"] },
      { id: "cargos", label: "Cargos", description: "Cargos e o que cada um pode ver e fazer", href: "/equipe/cargos", permission: "convidar_corretor", roles: ["director"], noCargo: true },
      { id: "recuperacoes", label: "Recuperações de acesso", description: "Pedidos de recuperação de acesso", href: "/equipe/recuperacoes", permission: "convidar_corretor", roles: ["director"], noCargo: true },
    ],
  },
];

function pathOf(href: string) {
  return href.split(/[?#]/, 1)[0] || "/";
}

function queryOf(href: string): Record<string, string> {
  const query = href.split("?")[1]?.split("#")[0];
  return query ? Object.fromEntries(new URLSearchParams(query)) : {};
}

function covers(prefix: string, pathname: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Leitor de query: URLSearchParams e o ReadonlyURLSearchParams do Next servem. */
export type NavSearch = { get(name: string): string | null };

/**
 * Quanto a aba cobre o endereço; 0 quando não cobre. Vence o caminho mais longo; no mesmo caminho,
 * a aba cuja query bate vence a aba sem query (a visão padrão da página).
 */
function tabMatchScore(tab: NavTab, pathname: string, search: NavSearch | null) {
  const own = pathOf(tab.href);
  const query = queryOf(tab.href);
  const keys = Object.keys(query);
  if (keys.length > 0) {
    // Uma aba de query também pode ser dona de outros caminhos (ex.: o detalhe de um plantão).
    const owned = (tab.paths ?? []).filter((candidate) => covers(candidate, pathname)).reduce((longest, candidate) => Math.max(longest, candidate.length), 0);
    if (owned > 0) return owned * 2 + 1;
    const samePage = [own, ...(tab.alsoAt ?? [])].find((candidate) => candidate === pathname);
    if (!samePage) return 0;
    const matches = keys.every((key) => {
      const value = search?.get(key) ?? null;
      return value === query[key] || (value !== null && (tab.aliases?.[key] ?? []).includes(value));
    });
    return matches ? samePage.length * 2 + 1 : 0;
  }
  let best = 0;
  for (const candidate of [own, ...(tab.paths ?? [])]) {
    if (covers(candidate, pathname) && candidate.length * 2 > best) best = candidate.length * 2;
  }
  return best;
}

export type NavMatch = { area: NavArea; tab: NavTab };

/** Área e aba de um endereço: vence o caminho mais específico entre todas as abas. */
export function resolveNavLocation(pathname: string, search: NavSearch | null = null): NavMatch | null {
  const [rawPath, rawQuery] = pathname.split("?");
  const path = (rawPath || "/").replace(/(.)\/+$/, "$1");
  const query = search ?? (rawQuery ? new URLSearchParams(rawQuery) : null);
  let found: NavMatch | null = null;
  let bestScore = 0;
  for (const area of NAV_AREAS) {
    for (const tab of area.tabs) {
      const score = tabMatchScore(tab, path, query);
      if (score > bestScore) {
        bestScore = score;
        found = { area, tab };
      }
    }
  }
  return found;
}

export type NavAccessUser = NavigationAccessUser & { negotiationsEnabled?: boolean; postSaleAuditEnabled?: boolean; autoSaleEnabled?: boolean; erpPaths?: readonly string[] };

export function canShowNavTab(tab: NavTab, user: NavAccessUser | null) {
  if (!user?.roleKey) return false;
  if (tab.roles && !tab.roles.includes(user.roleKey)) return false;
  // This allowlist is built by the server's module + cargo + resource-scope guards.
  // It is also the narrow exception to the manager's unchanged legacy menu boundary.
  if (tab.requires === "erp") return user.erpPaths?.includes(pathOf(tab.href)) === true;
  if (tab.requires === "negotiations" && !user.negotiationsEnabled) return false;
  if (tab.requires === "postSaleAudit" && !user.postSaleAuditEnabled) return false;
  if (tab.requires === "autoSale" && !user.autoSaleEnabled) return false;
  // Cargo (04/11, F2): as permissões trazem rotas "route:" só para quem tem cargo; aí a aba exige a capacidade.
  const permissions = user.permissions ?? [];
  const hasCargo = permissions.some((permission) => permission.startsWith("route:"));
  if (tab.noCargo && hasCargo) return false;
  if (tab.cargoCapability && hasCargo && !permissions.includes(tab.cargoCapability)) return false;
  return canShowNavigationItem({ url: tab.accessPath ?? tab.href, permission: tab.permission, requires: tab.requires === "relationshipCenter" ? "relationshipCenter" : undefined }, user);
}

export function visibleNavTabs(area: NavArea, user: NavAccessUser | null) {
  return area.tabs.filter((tab) => canShowNavTab(tab, user));
}

/**
 * Abas da fileira do topo: as visíveis que não moram no hub e, se a pessoa está numa aba do hub, essa aba no fim
 * (marcada como atual).
 */
export function navRowTabs(area: NavArea, user: NavAccessUser | null, currentTabId?: string | null) {
  const visible = visibleNavTabs(area, user);
  const row = visible.filter((tab) => !tab.hub);
  const current = visible.find((tab) => tab.id === currentTabId);
  return current?.hub ? [...row, current] : row;
}

/** Áreas que o usuário enxerga, cada uma com o destino da primeira aba visível. */
export function visibleNavAreas(user: NavAccessUser | null) {
  return NAV_AREAS.flatMap((area) => {
    const tabs = visibleNavTabs(area, user);
    return tabs.length > 0 ? [{ area, tabs, href: tabs[0].href }] : [];
  });
}

/**
 * Menu lateral (skill `interface-enxuta`): agrupa áreas sem mudar nomes, abas nem rotas.
 * A primeira área visível do grupo é o destino da entrada; as demais aparecem como subitens.
 *
 * 25/11/2026 (docs/research/deskcomm-crm-engenharia-reversa.md): a ordem segue o dia do diretor, do que se opera
 * para o que se ajusta, como no DeskComm. Configurações guarda só ajustes; Atendimento IA e Marketing operam leads
 * todo dia e ficam em Crescimento; Financeiro e Operação ERP ficam junto do Comercial, onde o dinheiro nasce.
 */
export type NavGroup = { id: string; label: string; areas: readonly NavAreaId[] };

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: "inicio", label: "Início", areas: ["inicio"] },
  { id: "conversas", label: "Conversas", areas: ["conversas"] },
  { id: "leads", label: "Leads", areas: ["leads", "distribuicao"] },
  { id: "comercial", label: "Comercial", areas: ["comercial", "financeiro", "erp"] },
  { id: "crescimento", label: "Crescimento", areas: ["atendimento-ia", "marketing"] },
  { id: "equipe", label: "Equipe", areas: ["equipe"] },
  { id: "configuracoes", label: "Configurações", areas: ["configuracoes"] },
];

/** Agrupa itens já filtrados por área; área fora dos grupos vira um grupo próprio no fim. Grupos vazios somem. */
export function groupNavItems<T extends { id: NavAreaId }>(items: readonly T[]): { group: NavGroup; items: T[] }[] {
  const grouped = NAV_GROUPS.map((group) => ({ group, items: group.areas.flatMap((areaId) => items.filter((item) => item.id === areaId)) }));
  const known = new Set(NAV_GROUPS.flatMap((group) => group.areas));
  const loose = items.filter((item) => !known.has(item.id)).map((item) => ({ group: { id: item.id, label: "", areas: [item.id] } as NavGroup, items: [item] }));
  return [...grouped, ...loose].filter((entry) => entry.items.length > 0);
}

/** Caminhos que são raiz de uma aba: no chrome do diretor não mostram "voltar". */
export function isNavTabRoot(pathname: string) {
  const path = pathOf(pathname).replace(/(.)\/+$/, "$1");
  return NAV_AREAS.some((area) => area.tabs.some((tab) => pathOf(tab.href) === path));
}
