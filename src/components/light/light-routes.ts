/**
 * Single source of truth for the broker app (Light mode) navigation: allowed
 * routes, bottom-bar tabs, "Mais" destinations, screen titles and parent routes.
 * Pure data and functions, so the server layout and the client chrome share it.
 */

/** Routes a Light broker may open. Anything else redirects to /dashboard (see (dashboard)/layout.tsx). */
export const LIGHT_ALLOWED_PREFIXES = [
  "/dashboard",
  "/minha-fila",
  "/jornada",
  "/cotacao",
  "/plantoes",
  "/leads",
  "/clientes",
  "/conversas",
  "/l/",
  "/settings",
  "/notificacoes",
  "/relacionamento",
  "/primeiro-acesso",
] as const;

/**
 * Supervisor Lite: route by route (never a bare prefix, which would let the
 * normal management screens like /leads/distribuicao in under the Lite chrome).
 */
const ID = "[^/]+";
export const LIGHT_SUPERVISOR_ALLOWED_ROUTES: readonly RegExp[] = [
  /^\/dashboard$/,
  new RegExp(`^/dashboard/c/${ID}$`),
  /^\/leads$/,
  new RegExp(`^/leads/(?!dashboard$|arquivados$|distribuicao(?:/|$))${ID}$`),
  /^\/clientes$/,
  new RegExp(`^/clientes/${ID}$`),
  /^\/equipe$/,
  /^\/equipe\/minha$/,
  /^\/equipe\/minha\/configurar$/,
  /^\/equipe\/desempenho$/,
  /^\/equipe\/transferencia$/,
  new RegExp(`^/equipe/(?!cargos$|convidar$|dashboard$|recuperacoes$)${ID}$`),
  /^\/relacionamento$/,
  /^\/notificacoes$/,
  /^\/settings$/,
  /^\/primeiro-acesso(\/.*)?$/,
  /^\/mensagens$/,
  new RegExp(`^/mensagens/${ID}$`),
];

/** The manager Lite starts with the unit dashboard and lead work only. */
export const LIGHT_MANAGER_ALLOWED_ROUTES: readonly RegExp[] = [
  /^\/dashboard$/,
  /^\/leads$/,
  new RegExp(`^/leads/(?!dashboard$|arquivados$|distribuicao$)${ID}$`),
  /^\/notificacoes$/,
  /^\/settings$/,
  /^\/primeiro-acesso$/,
  /^\/equipe$/,
  new RegExp(`^/equipe/(?!cargos(?:/|$)|convidar(?:/|$)|dashboard(?:/|$)|recuperacoes(?:/|$)|minha(?:/|$)|repassar(?:/|$)|transferencia(?:/|$))${ID}$`),
  /^\/clientes$/,
  new RegExp(`^/clientes/${ID}$`),
  /^\/mensagens$/,
  new RegExp(`^/mensagens/${ID}$`),
  /^\/empresas$/,
  new RegExp(`^/unidades/${ID}$`),
];

export function isLightRouteAllowed(pathname: string, audience: "broker" | "supervisor" | "manager" = "broker") {
  if (audience === "manager") {
    const path = pathname.split("?")[0] ?? pathname;
    return LIGHT_MANAGER_ALLOWED_ROUTES.some((route) => route.test(path));
  }
  if (audience === "supervisor") {
    const path = pathname.split("?")[0] ?? pathname;
    return LIGHT_SUPERVISOR_ALLOWED_ROUTES.some((route) => route.test(path));
  }
  return LIGHT_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

/** "Mais" of the supervisor. */
export const LIGHT_SUPERVISOR_DESTINATIONS: readonly LightMoreDestination[] = [
  { href: "/equipe/minha", label: "Minha equipe" },
  { href: "/equipe/desempenho", label: "Placar da equipe", requires: "teamRanking" },
  { href: "/equipe/transferencia", label: "Pedir corretor de outra equipe" },
  { href: "/relacionamento", label: "Central de relacionamento", requires: "relationshipCenter" },
  { href: "/clientes", label: "Clientes da equipe" },
  { href: "/mensagens", label: "Mensagens da equipe" },
  { href: "/notificacoes", label: "Notificações" },
  { href: "/settings", label: "Configurações" },
];

export const LIGHT_MANAGER_DESTINATIONS: readonly LightMoreDestination[] = [
  { href: "/leads", label: "Leads da unidade" },
  { href: "/equipe", label: "Equipe" },
  { href: "/clientes", label: "Clientes" },
  { href: "/mensagens", label: "Mensagens" },
  { href: "/empresas", label: "Empresas" },
  { href: "/notificacoes", label: "Notificações" },
  { href: "/settings", label: "Configurações" },
];

export type LightTabId = "inicio" | "fila" | "insights" | "mais";

export type LightTab = { id: Exclude<LightTabId, "mais">; href: string; label: string };

/** The three destinations that live directly in the bar; "Mais" opens the sheet. */
export const LIGHT_TABS: readonly LightTab[] = [
  { id: "inicio", href: "/dashboard", label: "Início" },
  { id: "fila", href: "/minha-fila", label: "Fila" },
  { id: "insights", href: "/conversas/broker", label: "Dicas de Atendimento" },
];

export type LightMoreDestination = {
  href: string;
  label: string;
  /** Hidden unless the matching capability is on. */
  requires?: "quoteSimulator" | "dutyCalendar" | "relationshipCenter" | "journey" | "teamRanking";
};

export const LIGHT_MORE_DESTINATIONS: readonly LightMoreDestination[] = [
  { href: "/jornada", label: "Minha jornada", requires: "journey" },
  { href: "/cotacao", label: "Cotação", requires: "quoteSimulator" },
  { href: "/plantoes", label: "Plantões", requires: "dutyCalendar" },
  { href: "/clientes", label: "Clientes" },
  { href: "/relacionamento", label: "Mural da gestão", requires: "relationshipCenter" },
  { href: "/notificacoes", label: "Notificações" },
  { href: "/settings", label: "Configurações" },
];

export function getLightMoreDestinations(capabilities: { quoteSimulator?: boolean; dutyCalendar?: boolean; relationshipCenter?: boolean; journey?: boolean; teamRanking?: boolean }, audience: "broker" | "supervisor" | "manager" = "broker") {
  const list = audience === "manager" ? LIGHT_MANAGER_DESTINATIONS : audience === "supervisor" ? LIGHT_SUPERVISOR_DESTINATIONS : LIGHT_MORE_DESTINATIONS;
  return list.filter((item) => !item.requires || capabilities[item.requires]);
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
  placar: { title: "Placar" },
  acessibilidade: { title: "Acessibilidade" },
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
  { test: exact("/jornada"), route: { title: "Minha jornada", tab: "mais", isRoot: false, parentHref: "/dashboard", hidesTabBar: true } },
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
      search?.get("insight")
        ? { title: "Análise", tab: "insights", isRoot: false, parentHref: "/conversas/broker", chat: true, hidesTabBar: true }
        : search?.get("leadId")
        ? { title: "Conversa", tab: "insights", isRoot: false, parentHref: "/conversas/broker?todas=1", backToParent: true }
        : search?.get("todas") === "1"
          ? { title: "Conversas", tab: "insights", isRoot: false, parentHref: "/conversas/broker", backToParent: true, chat: true, hidesTabBar: true }
          // The Insights assistant is a chat (2026-10-09) with its own header.
          : { title: "Dicas de Atendimento", tab: "insights", isRoot: true, parentHref: null, chat: true, hidesTabBar: true },
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
  { test: exact("/plantoes/agora"), route: { title: "Meu plantão agora", tab: "inicio", isRoot: false, parentHref: "/dashboard/c/plantao" } },
  { test: exact("/plantoes"), route: { title: "Plantões", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: exact("/relacionamento"), route: { title: "Mural da gestão", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: exact("/equipe/repassar"), route: { title: "Repassar lead", tab: "inicio", isRoot: false, parentHref: "/dashboard/c/equipe-leads" } },
  { test: exact("/equipe/transferencia"), route: { title: "Pedir transferência", tab: "mais", isRoot: false, parentHref: "/equipe" } },
  { test: exact("/equipe/minha"), route: { title: "Minha equipe", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: exact("/equipe/minha/configurar"), route: { title: "Configuração da equipe", tab: "mais", isRoot: false, parentHref: "/equipe/minha" } },
  { test: exact("/equipe/desempenho"), route: { title: "Placar da equipe", tab: "mais", isRoot: false, parentHref: "/equipe/minha" } },
  { test: exact("/equipe"), route: { title: "Minha unidade", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: under("/equipe"), route: { title: "Corretor", tab: "mais", isRoot: false, parentHref: "/equipe" } },
  { test: exact("/mensagens"), route: { title: "Mensagens", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: under("/mensagens"), route: { title: "Conversa", tab: "mais", isRoot: false, parentHref: "/mensagens", backToParent: true } },
  { test: under("/unidades"), route: { title: "Minha unidade", tab: "mais", isRoot: false, parentHref: "/equipe" } },
  { test: exact("/clientes"), route: { title: "Clientes", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
  { test: under("/clientes"), route: { title: "Cliente", tab: "mais", isRoot: false, parentHref: "/clientes" } },
  { test: exact("/empresas"), route: { title: "Empresas", tab: "mais", isRoot: false, parentHref: "/dashboard" } },
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
