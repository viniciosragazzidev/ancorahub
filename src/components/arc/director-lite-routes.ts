export const DIRECTOR_LITE_OPT_OUT_ROUTES = [
  "/agenda",
  "/assinatura",
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
  "/equipe/repassar",
  "/equipe/transferencia",
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
  "/internal/design-system",
  "/internal/design-system/motion",
  "/jornada",
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
  "/plantoes",
  "/plantoes/agora",
  "/plantoes/corretor/[brokerId]",
  "/qualificacao",
  "/qualificacao/turbo",
  "/relacionamento",
  "/roadmap",
  "/settings",
  "/settings/extension",
  "/settings/feedback-templates",
  "/settings/integrations",
  "/settings/meta",
  "/settings/waha-diagnostic",
  "/settings/whatsapp",
  "/unidades/[branchId]",
  "/vendas/dashboard",
  "/welcome",
] as const;

function routePatternMatches(pattern: string, pathname: string) {
  const expected = pattern.split("/").filter(Boolean);
  const actual = pathname.split("/").filter(Boolean);
  if (expected.length !== actual.length) return false;
  return expected.every((segment, index) => /^\[[^/]+\]$/.test(segment) || segment === actual[index]);
}

/**
 * Rotas fixas já revisadas que moram ao lado de uma rota dinâmica ainda em opt-out (ex.: /equipe/recuperacoes ao
 * lado de /equipe/[id]). Sem esta lista, o padrão dinâmico também pegaria a rota fixa e a deixaria fora do Lite.
 */
const DIRECTOR_LITE_REVISED_STATIC_ROUTES: ReadonlySet<string> = new Set([
  "/equipe/recuperacoes",
]);

export function isDirectorLiteDashboardRoute(pathname: string) {
  const normalized = normalizePathname(pathname);
  if (DIRECTOR_LITE_REVISED_STATIC_ROUTES.has(normalized)) return false;
  return DIRECTOR_LITE_OPT_OUT_ROUTES.some((route) => routePatternMatches(route, normalized));
}

export function isDirectorLiteRouteOptedOut(pathname: string) {
  return isDirectorLiteDashboardRoute(pathname);
}

function normalizePathname(pathname: string) {
  const clean = pathname.split("?")[0]?.replace(/\/$/, "") ?? "";
  return clean || "/";
}
