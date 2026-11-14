import type { PermissionKey } from "@/shared/auth/permissions";
import { ERP_IMPLEMENTED_ROUTES, ERP_ROUTE_RESERVATIONS } from "@/features/erp/route-reservations";

export const ROUTE_PERMISSION_PREFIX = "route:";

export type RouteDefinition = {
  key: string;
  path: string;
  label: string;
  description: string;
  category: string;
  /** Permissão base do papel: o piso da rota, para quem tem cargo ou não. */
  fallbackPermission: PermissionKey;
  /** A reservation is recognized but never assignable, navigable or accessible. */
  readiness?: "planned";
  noCargo?: boolean;
  /**
   * Rota que entrou no catálogo em 04/11: para quem NÃO tem cargo ela segue aberta como antes (cada página
   * já faz a própria checagem); para quem tem cargo vale a chave `route:<key>` + o piso do papel.
   */
  legacyOpen?: boolean;
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
  // 04/11 (cargos e permissões): rotas que existiam fora do catálogo. legacyOpen: nada muda para quem não
  // tem cargo; quem tem cargo precisa da chave da rota e do piso do papel.
  { key: "minha-fila", path: "/minha-fila", label: "Minha fila", description: "Fila de leads do corretor.", category: "Navegação principal", fallbackPermission: "acessar_leads", legacyOpen: true },
  { key: "plantoes", path: "/plantoes", label: "Plantões", description: "Calendário e escala de plantões.", category: "Distribuição", fallbackPermission: "acessar_leads", legacyOpen: true },
  { key: "tarefas", path: "/tarefas", label: "Tarefas", description: "Tarefas comerciais.", category: "Atendimento", fallbackPermission: "acessar_tarefas", legacyOpen: true },
  { key: "clientes", path: "/clientes", label: "Clientes", description: "Base de clientes.", category: "Atendimento", fallbackPermission: "acessar_clientes", legacyOpen: true },
  { key: "cotacao", path: "/cotacao", label: "Cotação", description: "Simulações e cotações.", category: "Atendimento", fallbackPermission: "acessar_cotacoes", legacyOpen: true },
  { key: "documentos", path: "/documentos", label: "Documentos", description: "Documentos enviados pelos clientes.", category: "Atendimento", fallbackPermission: "acessar_documentos", legacyOpen: true },
  { key: "propostas", path: "/propostas", label: "Propostas", description: "Propostas comerciais.", category: "Vendas", fallbackPermission: "acessar_vendas", legacyOpen: true },
  { key: "relacionamento", path: "/relacionamento", label: "Relacionamento", description: "Central de relacionamento.", category: "Atendimento", fallbackPermission: "acessar_clientes", legacyOpen: true },
  { key: "relatorios", path: "/relatorios", label: "Relatórios", description: "Relatórios e indicadores.", category: "Gestão", fallbackPermission: "acessar_relatorios", legacyOpen: true },
  { key: "desempenho", path: "/desempenho", label: "Desempenho", description: "Desempenho e ranking.", category: "Gestão", fallbackPermission: "acessar_dashboard", legacyOpen: true },
  { key: "jornada", path: "/jornada", label: "Jornada", description: "Jornada do corretor.", category: "Gestão", fallbackPermission: "acessar_dashboard", legacyOpen: true },
  { key: "agenda", path: "/agenda", label: "Agenda", description: "Agenda de compromissos.", category: "Atendimento", fallbackPermission: "acessar_tarefas", legacyOpen: true },
  { key: "notificacoes", path: "/notificacoes", label: "Notificações", description: "Central de notificações.", category: "Pessoal", fallbackPermission: "acessar_notificacoes", legacyOpen: true },
  { key: "ferramentas", path: "/ferramentas", label: "Ferramentas", description: "Ferramentas de vendas.", category: "Operação", fallbackPermission: "acessar_ferramentas_vendas", legacyOpen: true },
  { key: "mensagens", path: "/mensagens", label: "Mensagens", description: "Mensagens e modelos.", category: "Operação", fallbackPermission: "acessar_qualificacao_ia", legacyOpen: true },
  { key: "fluxos-whatsapp", path: "/fluxos-whatsapp", label: "Fluxos de WhatsApp", description: "Fluxos automáticos de WhatsApp.", category: "Operação", fallbackPermission: "acessar_qualificacao_ia", legacyOpen: true },
  { key: "integracoes", path: "/integrations", label: "Integrações", description: "Demais integrações.", category: "Integrações", fallbackPermission: "acessar_integracao_meta", legacyOpen: true },
  { key: "marketing", path: "/marketing", label: "Marketing", description: "Demais áreas de marketing.", category: "Marketing", fallbackPermission: "acessar_campanhas_meta", legacyOpen: true },
  { key: "unidades", path: "/unidades", label: "Unidades (detalhe)", description: "Página de cada unidade.", category: "Administração", fallbackPermission: "acessar_configuracoes_unidade", legacyOpen: true },
  { key: "gestao", path: "/gestao", label: "Gestão", description: "Área de gestão.", category: "Administração", fallbackPermission: "ver_dashboard_equipe", legacyOpen: true },
  { key: "configuracoes", path: "/configuracoes", label: "Configurações avançadas", description: "Comissões e configurações avançadas.", category: "Administração", fallbackPermission: "ver_comissionamento", legacyOpen: true },
  { key: "extensao", path: "/extensao", label: "Extensão do WhatsApp", description: "Extensão do navegador.", category: "Integrações", fallbackPermission: "acessar_conversas", legacyOpen: true },
  { key: "assistente", path: "/assistente", label: "Assistente", description: "Assistente de IA.", category: "Operação", fallbackPermission: "acessar_dashboard", legacyOpen: true },
  { key: "guia", path: "/guia", label: "Guia", description: "Guia de uso.", category: "Pessoal", fallbackPermission: "acessar_guia", legacyOpen: true },
  ...ERP_IMPLEMENTED_ROUTES.filter((route) => !route.noCargo),
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
  // Meu financeiro do corretor (Lite) lê as próprias comissões: quem tem cargo precisa da mesma rota de Comissões.
  { path: "/meu-financeiro", key: "erp-comissoes" },
];

const resolvedRoutes: readonly RouteDefinition[] = [...routeCatalog, ...ERP_IMPLEMENTED_ROUTES.filter((route) => route.noCargo), ...ERP_ROUTE_RESERVATIONS];

/** Includes blocked reservations; use routeCatalog when offering assignable routes. */
export function getRouteDefinitionByKey(key: string): RouteDefinition | undefined {
  return resolvedRoutes.find((route) => route.key === key);
}

/** Rota pelo prefixo mais longo: `/leads/distribuicao/...` é Distribuição, não Leads. */
export function getRouteDefinition(pathname: string): RouteDefinition | undefined {
  let melhor: RouteDefinition | undefined;
  for (const route of resolvedRoutes) {
    if (pathname !== route.path && !pathname.startsWith(`${route.path}/`)) continue;
    if (!melhor || route.path.length > melhor.path.length) melhor = route;
  }
  for (const alias of routeAliases) {
    if (pathname !== alias.path && !pathname.startsWith(`${alias.path}/`)) continue;
    if (!melhor || alias.path.length > melhor.path.length)
    {
      const base = (routeCatalog as readonly RouteDefinition[]).find((route) => route.key === alias.key);
      // Para quem não tem cargo o apelido não muda nada (antes casava como Leads, que todo papel abre).
      melhor = base ? { ...base, path: alias.path, legacyOpen: true } : melhor;
    }
  }
  return melhor;
}

export function routePermissionForPath(pathname: string) {
  const route = getRouteDefinition(pathname);
  return route ? routePermissionKey(route.key) : null;
}
