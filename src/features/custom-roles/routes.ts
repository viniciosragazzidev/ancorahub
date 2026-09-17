import type { PermissionKey } from "@/shared/auth/permissions";

export const ROUTE_PERMISSION_PREFIX = "route:";

export type RouteDefinition = {
  key: string;
  path: string;
  label: string;
  description: string;
  category: string;
  fallbackPermission: PermissionKey;
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
] as const;

export type RouteKey = (typeof routeCatalog)[number]["key"];

export function routePermissionKey(routeKey: string) {
  return `${ROUTE_PERMISSION_PREFIX}${routeKey}`;
}

export function isRoutePermission(value: string) {
  return value.startsWith(ROUTE_PERMISSION_PREFIX) && value.length > ROUTE_PERMISSION_PREFIX.length;
}

export function getRouteDefinition(pathname: string) {
  return routeCatalog.find(
    (route) => pathname === route.path || pathname.startsWith(`${route.path}/`),
  );
}

export function routePermissionForPath(pathname: string) {
  const route = getRouteDefinition(pathname);
  return route ? routePermissionKey(route.key) : null;
}
