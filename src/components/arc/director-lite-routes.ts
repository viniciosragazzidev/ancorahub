export const DIRECTOR_LITE_OPT_OUT_ROUTES = [
  "/agenda",
  "/assinatura",
  "/assistente",
  "/atendimento",
  "/atendimento/fluxo",
  "/atendimento/mensagens",
  "/atendimento/situacoes",
  "/clientes",
  "/clientes/[clientId]",
  "/configuracoes/comissoes",
  "/conversas",
  "/conversas/broker",
  "/conversas/dashboard",
  "/cotacao",
  "/dashboard",
  "/dashboard/c/[assistant]",
  "/dashboard/drill/[drillId]",
  "/desempenho",
  "/distribuicao",
  "/distribuicao/dashboard",
  "/documentos",
  "/empresas",
  "/equipe",
  "/equipe/[id]",
  "/equipe/cargos",
  "/equipe/convidar",
  "/equipe/dashboard",
  "/equipe/desempenho",
  "/equipe/minha",
  "/equipe/minha/configurar",
  "/equipe/plantao",
  "/equipe/recuperacoes",
  "/equipe/repassar",
  "/equipe/transferencia",
  "/ferramentas",
  "/ferramentas/materiais-operadoras",
  "/ferramentas/validador-comprovante",
  "/filiais",
  "/fluxos-whatsapp",
  "/gestao",
  "/gestao/equipes/[supervisorId]",
  "/guia",
  "/guia/webhook",
  "/integrations",
  "/integrations/meta",
  "/integrations/whats_alt",
  "/integrations/whatsapp",
  "/integridade",
  "/internal/design-system",
  "/internal/design-system/motion",
  "/jornada",
  "/leads",
  "/leads/[id]",
  "/leads/[id]/feedback",
  "/leads/arquivados",
  "/leads/dashboard",
  "/leads/distribuicao",
  "/leads/distribuicao/plantao",
  "/leads/distribuicao/plantao/[scheduleId]",
  "/marketing",
  "/marketing/campanhas",
  "/marketing/campanhas/[id]",
  "/marketing/importacoes",
  "/marketing/meta",
  "/mensagens",
  "/mensagens/[leadId]",
  "/minha-fila",
  "/noc",
  "/notificacoes",
  "/plantoes",
  "/plantoes/agora",
  "/plantoes/corretor/[brokerId]",
  "/propostas",
  "/qualificacao",
  "/qualificacao/turbo",
  "/relacionamento",
  "/relatorios",
  "/relatorios/drill/[drillId]",
  "/roadmap",
  "/settings",
  "/settings/extension",
  "/settings/feedback-templates",
  "/settings/integrations",
  "/settings/meta",
  "/settings/waha-diagnostic",
  "/settings/whatsapp",
  "/tarefas/dashboard",
  "/unidades/[branchId]",
  "/vendas",
  "/vendas/[id]",
  "/vendas/dashboard",
  "/welcome",
] as const;

function routePatternMatches(pattern: string, pathname: string) {
  const expected = pattern.split("/").filter(Boolean);
  const actual = pathname.split("/").filter(Boolean);
  if (expected.length !== actual.length) return false;
  return expected.every((segment, index) => /^\[[^/]+\]$/.test(segment) || segment === actual[index]);
}

export function isDirectorLiteDashboardRoute(pathname: string) {
  const normalized = normalizePathname(pathname);
  return DIRECTOR_LITE_OPT_OUT_ROUTES.some((route) => routePatternMatches(route, normalized));
}

export function isDirectorLiteRouteOptedOut(pathname: string) {
  return isDirectorLiteDashboardRoute(pathname);
}

function normalizePathname(pathname: string) {
  const clean = pathname.split("?")[0]?.replace(/\/$/, "") ?? "";
  return clean || "/";
}
