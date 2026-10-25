export const DIRECTOR_LITE_OPT_OUT_ROUTES = [
  "/agenda",
  "/atendimento",
  "/atendimento/fluxo",
  "/atendimento/mensagens",
  "/atendimento/situacoes",
  "/clientes",
  "/clientes/[clientId]",
  "/configuracoes/comissoes",
  "/conversas/broker",
  "/conversas/dashboard",
  "/cotacao",
  "/dashboard/c/[assistant]",
  "/dashboard/drill/[drillId]",
  "/desempenho",
  "/distribuicao",
  "/distribuicao/dashboard",
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
  "/filiais",
  "/fluxos-whatsapp",
  "/gestao",
  "/gestao/equipes/[supervisorId]",
  "/integrations",
  "/integrations/whats_alt",
  "/integrations/whatsapp",
  "/internal/design-system",
  "/internal/design-system/motion",
  "/jornada",
  "/leads/[id]/feedback",
  "/leads/arquivados",
  "/leads/dashboard",
  "/leads/distribuicao",
  "/leads/distribuicao/plantao",
  "/leads/distribuicao/plantao/[scheduleId]",
  "/mensagens",
  "/mensagens/[leadId]",
  "/minha-fila",
  "/plantoes",
  "/plantoes/agora",
  "/plantoes/corretor/[brokerId]",
  "/qualificacao",
  "/qualificacao/turbo",
  "/relacionamento",
  "/settings",
  "/settings/extension",
  "/settings/feedback-templates",
  "/settings/integrations",
  "/settings/meta",
  "/settings/waha-diagnostic",
  "/settings/whatsapp",
  "/unidades/[branchId]",
  "/vendas/dashboard",
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
