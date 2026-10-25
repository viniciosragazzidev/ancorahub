export const DIRECTOR_LITE_OPT_OUT_ROUTES = [
  "/agenda",
  "/clientes",
  "/clientes/[clientId]",
  "/conversas/broker",
  "/conversas/dashboard",
  "/cotacao",
  "/dashboard/c/[assistant]",
  "/dashboard/drill/[drillId]",
  "/desempenho",
  "/equipe/dashboard",
  "/equipe/desempenho",
  "/equipe/minha",
  "/equipe/minha/configurar",
  "/equipe/plantao",
  "/equipe/repassar",
  "/equipe/transferencia",
  "/filiais",
  "/gestao",
  "/gestao/equipes/[supervisorId]",
  "/internal/design-system",
  "/internal/design-system/motion",
  "/jornada",
  "/leads/[id]/feedback",
  "/leads/arquivados",
  "/leads/dashboard",
  "/leads/distribuicao/plantao",
  "/mensagens",
  "/mensagens/[leadId]",
  "/plantoes",
  "/relacionamento",
  "/vendas/dashboard",
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
  "/equipe/convidar",
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
