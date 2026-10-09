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
  { href: "/notificacoes", label: "Notificações" },
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
  /** Detail screens with their own fixed action bar hide the floating tab bar. */
  hidesTabBar?: boolean;
  /** Back always goes to the parent (used when the screen state lives in the URL, not in history). */
  backToParent?: boolean;
  /** Chat screens (2026-10-09 chat redesign) draw their own header and need no tab bar, header or rail. */
  chat?: boolean;
};

/** Query parameters a rule may read (URLSearchParams and Next ReadonlyURLSearchParams both fit). */
export type LightSearchParams = { get(name: string): string | null };

type RouteRule = { test: (path: string) => boolean; route: LightRoute | ((path: string, search: LightSearchParams | null) => LightRoute) };

const exact = (target: string) => (path: string) => path === target;
const under = (target: string) => (path: string) => path.startsWith(`${target}/`);

const SETTINGS_SECTIONS: Record<string, { title: string; hidesTabBar?: boolean }> = {
  conta: { title: "Minha conta" },
  // The availability screen has its own save bar where the tab bar would be.
  disponibilidade: { title: "Disponibilidade", hidesTabBar: true },
  whatsapp: { title: "WhatsApp" },
  seguranca: { title: "Segurança" },
  passkey: { title: "Segurança" },
  extensao: { title: "Extensão" },
};

// Order matters: first match wins, most specific first.
const RULES: readonly RouteRule[] = [
  { test: exact("/dashboard"), route: { title: "Início", tab: "inicio", isRoot: true, parentHref: null, chat: true, hidesTabBar: true } },
  { test: under("/dashboard/c"), route: { title: "Conversa", tab: "inicio", isRoot: false, parentHref: "/dashboard", chat: true, hidesTabBar: true } },
  { test: under("/dashboard"), route: { title: "Detalhe", tab: "inicio", isRoot: false, parentHref: "/dashboard" } },
  // No tab bar since the chat redesign: the queue goes back to Início (the conversations).
  { test: exact("/minha-fila"), route: { title: "Fila", tab: "fila", isRoot: false, parentHref: "/dashboard", hidesTabBar: true } },
  // Always to Início: going back through history here could return to the lead it was opened from.
  { test: exact("/leads"), route: { title: "Fila", tab: "fila", isRoot: false, parentHref: "/dashboard", backToParent: true, hidesTabBar: true } },
  // Feedback is a short form with no action bar: it goes back to its lead and keeps the tab bar.
  {
    test: (path) => /^\/leads\/[^/]+\/feedback$/.test(path),
    route: (path) => ({ title: "Atualização", tab: "fila", isRoot: false, parentHref: path.replace(/\/feedback$/, "") }),
  },
  // The lead is a chat (2026-10-09); ?ficha=1 is the full record with its own header.
  {
    test: under("/leads"),
    route: (path, search) =>
      search?.get("ficha") === "1"
        ? { title: "Lead", tab: "fila", isRoot: false, parentHref: path, hidesTabBar: true, backToParent: true }
        : { title: "Lead", tab: "fila", isRoot: false, parentHref: "/minha-fila", hidesTabBar: true, chat: true },
  },
  // Insights is a list; with ?leadId a conversation is open and back returns to the list.
  {
    test: exact("/conversas/broker"),
    route: (_path, search) =>
      search?.get("leadId")
        ? { title: "Conversa", tab: "insights", isRoot: false, parentHref: "/conversas/broker?todas=1", backToParent: true }
        : search?.get("todas") === "1"
          ? { title: "Conversas", tab: "insights", isRoot: false, parentHref: "/conversas/broker", backToParent: true, chat: true, hidesTabBar: true }
          // The Insights assistant is a chat (2026-10-09) with its own header.
          : { title: "Insights", tab: "insights", isRoot: true, parentHref: null, chat: true, hidesTabBar: true },
  },
  { test: under("/conversas"), route: { title: "Conversa", tab: "insights", isRoot: false, parentHref: "/conversas/broker" } },
  { test: exact("/conversas"), route: { title: "Insights", tab: "insights", isRoot: false, parentHref: "/conversas/broker" } },
  // The quote is a guided chat (2026-10-09); ?completo=1 is the full simulator.
  {
    test: exact("/cotacao"),
    route: (_path, search) =>
      search?.get("completo") === "1"
        ? { title: "Cotação", tab: "mais", isRoot: false, parentHref: "/cotacao", hidesTabBar: true, backToParent: true }
        : { title: "Cotação", tab: "mais", isRoot: false, parentHref: "/dashboard", hidesTabBar: true, chat: true },
  },
  { test: exact("/plantoes"), route: { title: "Plantões", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: exact("/clientes"), route: { title: "Clientes", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: under("/clientes"), route: { title: "Cliente", tab: "mais", isRoot: false, parentHref: "/clientes" } },
  // Settings is a list of sections; ?tab opens one and back returns to the list.
  {
    test: exact("/settings"),
    route: (_path, search) => {
      const section = SETTINGS_SECTIONS[search?.get("tab") ?? ""];
      return section
        ? { title: section.title, tab: "mais", isRoot: false, parentHref: "/settings", backToParent: true, hidesTabBar: section.hidesTabBar }
        : { title: "Configurações", tab: "mais", isRoot: false, parentHref: "/dashboard" };
    },
  },
  { test: under("/settings"), route: { title: "Configurações", tab: "mais", isRoot: false, parentHref: "/settings" } },
  { test: exact("/notificacoes"), route: { title: "Notificações", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  // Onboarding: a single guided screen, no tabs and nowhere to go back to.
  { test: exact("/primeiro-acesso"), route: { title: "Primeiro acesso", tab: "inicio", isRoot: true, parentHref: null, hidesTabBar: true } },
];

const FALLBACK_ROUTE: LightRoute = { title: "Ancora", tab: "inicio", isRoot: false, parentHref: "/dashboard" };

/** Resolves title, active tab and parent for a pathname; only a few rules read the query (Insights). */
export function resolveLightRoute(pathname: string, search: LightSearchParams | null = null): LightRoute {
  const path = pathname.split("?")[0].replace(/(.)\/+$/, "$1");
  const rule = RULES.find((candidate) => candidate.test(path));
  if (!rule) return FALLBACK_ROUTE;
  return typeof rule.route === "function" ? rule.route(path, search) : rule.route;
}
