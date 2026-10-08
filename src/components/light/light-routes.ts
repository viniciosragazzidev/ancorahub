/**
 * Single source of truth for the broker app (Light mode) navigation: allowed
 * routes, bottom-bar tabs, "Mais" destinations, screen titles and parent routes.
 * Pure data and functions, so the server layout and the client chrome share it.
 */

/** Routes a Light broker may open. Anything else redirects to /dashboard (see (dashboard)/layout.tsx). */
export const LIGHT_ALLOWED_PREFIXES = [
  "/dashboard",
  "/minha-fila",
  "/cotacao",
  "/plantoes",
  "/leads",
  "/clientes",
  "/conversas",
  "/l/",
  "/settings",
  "/notificacoes",
  "/primeiro-acesso",
] as const;

export function isLightRouteAllowed(pathname: string) {
  return LIGHT_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export type LightTabId = "inicio" | "fila" | "insights" | "mais";

export type LightTab = { id: Exclude<LightTabId, "mais">; href: string; label: string };

/** The three destinations that live directly in the bar; "Mais" opens the sheet. */
export const LIGHT_TABS: readonly LightTab[] = [
  { id: "inicio", href: "/dashboard", label: "Início" },
  { id: "fila", href: "/minha-fila", label: "Fila" },
  { id: "insights", href: "/conversas/broker", label: "Insights" },
];

export type LightMoreDestination = {
  href: string;
  label: string;
  /** Hidden unless the matching capability is on. */
  requires?: "quoteSimulator" | "dutyCalendar";
};

export const LIGHT_MORE_DESTINATIONS: readonly LightMoreDestination[] = [
  { href: "/cotacao", label: "Cotação", requires: "quoteSimulator" },
  { href: "/plantoes", label: "Plantões", requires: "dutyCalendar" },
  { href: "/clientes", label: "Clientes" },
  { href: "/settings", label: "Configurações" },
];

export function getLightMoreDestinations(capabilities: { quoteSimulator?: boolean; dutyCalendar?: boolean }) {
  return LIGHT_MORE_DESTINATIONS.filter((item) => !item.requires || capabilities[item.requires]);
}

export type LightRoute = {
  /** Title shown in the app header. */
  title: string;
  /** Tab highlighted in the bar/rail; "mais" for destinations behind the sheet. */
  tab: LightTabId;
  /** First-level screen of a tab: no back button. */
  isRoot: boolean;
  /** Where "back" goes when there is no usable history. */
  parentHref: string | null;
};

type RouteRule = { test: (path: string) => boolean; route: LightRoute };

const exact = (target: string) => (path: string) => path === target;
const under = (target: string) => (path: string) => path.startsWith(`${target}/`);

// Order matters: first match wins, most specific first.
const RULES: readonly RouteRule[] = [
  { test: exact("/dashboard"), route: { title: "Início", tab: "inicio", isRoot: true, parentHref: null } },
  { test: under("/dashboard"), route: { title: "Detalhe", tab: "inicio", isRoot: false, parentHref: "/dashboard" } },
  { test: exact("/minha-fila"), route: { title: "Fila", tab: "fila", isRoot: true, parentHref: null } },
  { test: exact("/leads"), route: { title: "Fila", tab: "fila", isRoot: false, parentHref: "/minha-fila" } },
  { test: under("/leads"), route: { title: "Lead", tab: "fila", isRoot: false, parentHref: "/minha-fila" } },
  { test: exact("/conversas/broker"), route: { title: "Insights", tab: "insights", isRoot: true, parentHref: null } },
  { test: under("/conversas"), route: { title: "Conversa", tab: "insights", isRoot: false, parentHref: "/conversas/broker" } },
  { test: exact("/conversas"), route: { title: "Insights", tab: "insights", isRoot: false, parentHref: "/conversas/broker" } },
  { test: exact("/cotacao"), route: { title: "Cotação", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: exact("/plantoes"), route: { title: "Plantões", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: exact("/clientes"), route: { title: "Clientes", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: under("/clientes"), route: { title: "Cliente", tab: "mais", isRoot: false, parentHref: "/clientes" } },
  { test: exact("/settings"), route: { title: "Configurações", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: under("/settings"), route: { title: "Configurações", tab: "mais", isRoot: false, parentHref: "/settings" } },
  { test: exact("/notificacoes"), route: { title: "Notificações", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
];

const FALLBACK_ROUTE: LightRoute = { title: "Ancora", tab: "inicio", isRoot: false, parentHref: "/dashboard" };

/** Resolves title, active tab and parent for a pathname (query string ignored). */
export function resolveLightRoute(pathname: string): LightRoute {
  const path = pathname.split("?")[0].replace(/(.)\/+$/, "$1");
  return RULES.find((rule) => rule.test(path))?.route ?? FALLBACK_ROUTE;
}
