import type { PermissionKey } from "@/shared/auth/permissions";

export const ROUTE_PERMISSION_PREFIX = "route:";

export type RouteDefinition = {
  key: string;
  path: string;
  label: string;
  description: string;
  category: string;
  /**
   * Permissão base do papel. Sem ela, a rota segue aberta para quem não tem cargo (como antes) e, para quem
   * tem cargo, depende só da chave `route:<key>`.
   */
  fallbackPermission?: PermissionKey;
};

/** Rotas de primeiro nível que podem ser ocultadas por um cargo personalizado. */
export const routeCatalog: readonly RouteDefinition[] = [
  {
    key: "dashboard",
    path: "/dashboard",
    label: "Painel",
    description: "Dashboard e visão geral da empresa.",
    category: "Navegação principal",
    fallbackPermission: "acessar_dashboard",
  },
  {
    key: "conversas",
    path: "/conversas",
    label: "Atendimento",
    description: "Conversas, WhatsApp e histórico de atendimento.",
    category: "Navegação principal",
    fallbackPermission: "acessar_conversas",
  },
  {
    key: "negociacoes",
    path: "/negociacoes",
    label: "Negociações",
    description: "Acompanhamento de negociações e sinais de atendimento da equipe.",
    category: "Navegação principal",
    fallbackPermission: "ver_dashboard_equipe",
  },
  {
    key: "leads",
    path: "/leads",
    label: "Leads",
    description: "Leads, oportunidades e carteira comercial.",
    category: "Navegação principal",
    fallbackPermission: "acessar_leads",
  },
  {
    key: "distribuicao",
    path: "/distribuicao",
    label: "Distribuição",
    description: "Filas, regras, plantões e operação de distribuição.",
    category: "Navegação principal",
    fallbackPermission: "lead_queues_view",
  },
  {
    key: "vendas",
    path: "/vendas",
    label: "Vendas",
    description: "Negociações, propostas e fechamentos.",
    category: "Navegação principal",
    fallbackPermission: "acessar_vendas",
  },
  {
    key: "equipe",
    path: "/equipe",
    label: "Equipe",
    description: "Membros, cargos e colaboradores.",
    category: "Administração",
    fallbackPermission: "convidar_corretor",
  },
  {
    key: "qualificacao",
    path: "/qualificacao",
    label: "Qualificação IA",
    description: "Configuração e monitoramento da qualificação automática.",
    category: "Operação",
    fallbackPermission: "acessar_qualificacao_ia",
  },
  {
    key: "atendimento",
    path: "/atendimento",
    label: "Atendimento",
    description: "Mensagens do atendimento: templates Meta, textos livres e respostas da IA.",
    category: "Operação",
    fallbackPermission: "acessar_qualificacao_ia",
  },
  {
    key: "whatsapp",
    path: "/integrations/whatsapp",
    label: "WhatsApp",
    description: "Conexões e canais de WhatsApp.",
    category: "Integrações",
    fallbackPermission: "acessar_configuracoes_pessoais",
  },
  {
    key: "campanhas",
    path: "/marketing/campanhas",
    label: "Campanhas",
    description: "Campanhas, formulários e anúncios Meta.",
    category: "Marketing",
    fallbackPermission: "acessar_campanhas_meta",
  },
  {
    key: "filiais",
    path: "/filiais",
    label: "Unidades",
    description: "Filiais e configurações das unidades.",
    category: "Administração",
    fallbackPermission: "acessar_configuracoes_unidade",
  },
  {
    key: "settings",
    path: "/settings",
    label: "Configurações",
    description: "Preferências e configurações do sistema.",
    category: "Administração",
    fallbackPermission: "acessar_configuracoes_pessoais",
  },
  // 04/11 (cargos e permissões): rotas que existiam fora do catálogo. Sem permissão base, nada muda para
  // quem não tem cargo; quem tem cargo só abre com a chave da rota.
  { key: "minha-fila", path: "/minha-fila", label: "Minha fila", description: "Fila de leads do corretor.", category: "Navegação principal" },
  { key: "plantoes", path: "/plantoes", label: "Plantões", description: "Calendário e escala de plantões.", category: "Distribuição" },
  { key: "tarefas", path: "/tarefas", label: "Tarefas", description: "Tarefas comerciais.", category: "Atendimento" },
  { key: "clientes", path: "/clientes", label: "Clientes", description: "Base de clientes.", category: "Atendimento" },
  { key: "cotacao", path: "/cotacao", label: "Cotação", description: "Simulações e cotações.", category: "Atendimento" },
  { key: "documentos", path: "/documentos", label: "Documentos", description: "Documentos enviados pelos clientes.", category: "Atendimento" },
  { key: "propostas", path: "/propostas", label: "Propostas", description: "Propostas comerciais.", category: "Vendas" },
  { key: "relacionamento", path: "/relacionamento", label: "Relacionamento", description: "Central de relacionamento.", category: "Atendimento" },
  { key: "relatorios", path: "/relatorios", label: "Relatórios", description: "Relatórios e indicadores.", category: "Gestão" },
  { key: "desempenho", path: "/desempenho", label: "Desempenho", description: "Desempenho e ranking.", category: "Gestão" },
  { key: "jornada", path: "/jornada", label: "Jornada", description: "Jornada do corretor.", category: "Gestão" },
  { key: "agenda", path: "/agenda", label: "Agenda", description: "Agenda de compromissos.", category: "Atendimento" },
  { key: "notificacoes", path: "/notificacoes", label: "Notificações", description: "Central de notificações.", category: "Pessoal" },
  { key: "ferramentas", path: "/ferramentas", label: "Ferramentas", description: "Ferramentas de vendas.", category: "Operação" },
  { key: "mensagens", path: "/mensagens", label: "Mensagens", description: "Mensagens e modelos.", category: "Operação" },
  { key: "fluxos-whatsapp", path: "/fluxos-whatsapp", label: "Fluxos de WhatsApp", description: "Fluxos automáticos de WhatsApp.", category: "Operação" },
  { key: "integracoes", path: "/integrations", label: "Integrações", description: "Demais integrações.", category: "Integrações" },
  { key: "marketing", path: "/marketing", label: "Marketing", description: "Demais áreas de marketing.", category: "Marketing" },
  { key: "unidades", path: "/unidades", label: "Unidades (detalhe)", description: "Página de cada unidade.", category: "Administração" },
  { key: "gestao", path: "/gestao", label: "Gestão", description: "Área de gestão.", category: "Administração" },
  { key: "configuracoes", path: "/configuracoes", label: "Configurações avançadas", description: "Comissões e configurações avançadas.", category: "Administração" },
  { key: "extensao", path: "/extensao", label: "Extensão do WhatsApp", description: "Extensão do navegador.", category: "Integrações" },
  { key: "assistente", path: "/assistente", label: "Assistente", description: "Assistente de IA.", category: "Operação" },
  { key: "guia", path: "/guia", label: "Guia", description: "Guia de uso.", category: "Pessoal" },
] as const;

export type RouteKey = (typeof routeCatalog)[number]["key"];

export function routePermissionKey(routeKey: string) {
  return `${ROUTE_PERMISSION_PREFIX}${routeKey}`;
}

export function isRoutePermission(value: string) {
  return value.startsWith(ROUTE_PERMISSION_PREFIX) && value.length > ROUTE_PERMISSION_PREFIX.length;
}

/** Outros caminhos que pertencem a uma rota do catálogo (não aparecem como item próprio na tela de cargos). */
const routeAliases: readonly { path: string; key: string }[] = [
  { path: "/leads/distribuicao", key: "distribuicao" },
];

/** Rota pelo prefixo mais longo: `/leads/distribuicao/...` é Distribuição, não Leads. */
export function getRouteDefinition(pathname: string): RouteDefinition | undefined {
  let melhor: RouteDefinition | undefined;
  for (const route of routeCatalog as readonly RouteDefinition[]) {
    if (pathname !== route.path && !pathname.startsWith(`${route.path}/`)) continue;
    if (!melhor || route.path.length > melhor.path.length) melhor = route;
  }
  for (const alias of routeAliases) {
    if (pathname !== alias.path && !pathname.startsWith(`${alias.path}/`)) continue;
    if (!melhor || alias.path.length > melhor.path.length)
      melhor = (routeCatalog as readonly RouteDefinition[]).find((route) => route.key === alias.key);
  }
  return melhor;
}

export function routePermissionForPath(pathname: string) {
  const route = getRouteDefinition(pathname);
  return route ? routePermissionKey(route.key) : null;
}
