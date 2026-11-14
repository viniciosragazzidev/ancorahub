/**
 * Filtros da "Minha carteira" (etapa 4a do plano do modo corretor), sem dependência de servidor para a tela usar.
 * Situação e origem são campos distintos: situação é a etapa do lead (Em negociação), o motivo do arquivamento
 * (Arquivados) ou o contrato e o retorno (Clientes e Precisa de atenção); origem é sempre `leads.origem`.
 */

export const BROKER_WALLET_VIEWS = ["negotiating", "all", "attention", "archived"] as const;
export type BrokerWalletView = (typeof BROKER_WALLET_VIEWS)[number];
export type BrokerWalletLeadView = Extract<BrokerWalletView, "negotiating" | "archived">;

/** Etapas do funil ainda em atendimento (as mesmas da fila do corretor e de `ACTIVE_LEAD_STATUSES`). */
export const BROKER_WALLET_NEGOTIATING_STAGES = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
  "awaiting_reply",
] as const;
export type BrokerWalletNegotiatingStage = (typeof BROKER_WALLET_NEGOTIATING_STAGES)[number];

/** Arquivados: perdido (`status = lost`) ou arquivado pela gestão (`archived_at`). */
export const BROKER_WALLET_ARCHIVED_STAGES = ["lost", "archived"] as const;
export type BrokerWalletArchivedStage = (typeof BROKER_WALLET_ARCHIVED_STAGES)[number];

export type BrokerWalletStage = BrokerWalletNegotiatingStage | BrokerWalletArchivedStage;

export const BROKER_WALLET_ORIGINS = ["manual", "webhook"] as const;
export type BrokerWalletOrigin = (typeof BROKER_WALLET_ORIGINS)[number];

export const BROKER_WALLET_MAX_PAGE = 50_000;

export type BrokerWalletFilters = {
  view: BrokerWalletView;
  page: number;
  query?: string;
  origin?: BrokerWalletOrigin;
  stage?: BrokerWalletStage;
  contractStatus?: "active" | "cancelled";
  returnStatus?: "overdue" | "today" | "future" | "none";
};

export type BrokerWalletFilterInput = {
  view?: string;
  page?: unknown;
  query?: string;
  origin?: string;
  stage?: string;
  contractStatus?: string;
  returnStatus?: string;
};

export function isBrokerWalletLeadView(view: BrokerWalletView): view is BrokerWalletLeadView {
  return view === "negotiating" || view === "archived";
}

function clampPage(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(BROKER_WALLET_MAX_PAGE, Math.max(1, Math.trunc(parsed)));
}

function includes<T extends string>(list: readonly T[], value: string | undefined): value is T {
  return value !== undefined && (list as readonly string[]).includes(value);
}

/**
 * Normaliza a URL. Sem visão, abre "Em negociação"; o antigo `renewals` cai em "Precisa de atenção", onde as
 * renovações já entram quando há dado (DEC-180). Cada filtro de situação só vale na visão a que pertence.
 */
export function normalizeBrokerWalletFilters(input: BrokerWalletFilterInput): BrokerWalletFilters {
  const requestedView = input.view === "renewals" ? "attention" : input.view;
  const view: BrokerWalletView = includes(BROKER_WALLET_VIEWS, requestedView) ? requestedView : "negotiating";
  const query = input.query?.trim().slice(0, 100) ?? "";
  const origin = input.origin?.trim();
  const stageList: readonly string[] = view === "negotiating"
    ? BROKER_WALLET_NEGOTIATING_STAGES
    : view === "archived" ? BROKER_WALLET_ARCHIVED_STAGES : [];
  const clientView = !isBrokerWalletLeadView(view);
  return {
    view,
    page: clampPage(input.page),
    ...(query ? { query } : {}),
    ...(includes(BROKER_WALLET_ORIGINS, origin) ? { origin } : {}),
    ...(input.stage && stageList.includes(input.stage) ? { stage: input.stage as BrokerWalletStage } : {}),
    ...(clientView && (input.contractStatus === "active" || input.contractStatus === "cancelled") ? { contractStatus: input.contractStatus } : {}),
    ...(clientView && includes(["overdue", "today", "future", "none"] as const, input.returnStatus) ? { returnStatus: input.returnStatus } : {}),
  };
}

/** URL da carteira; trocar de visão mantém busca e origem e descarta a situação, que é própria de cada visão. */
export function serializeBrokerWalletFilters(filters: BrokerWalletFilters) {
  const params = new URLSearchParams();
  params.set("view", filters.view);
  params.set("page", String(filters.page));
  if (filters.query) params.set("q", filters.query);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.stage) params.set("situacao", filters.stage);
  if (filters.contractStatus) params.set("contract", filters.contractStatus);
  if (filters.returnStatus) params.set("return", filters.returnStatus);
  return params.toString();
}

export function brokerWalletHref(filters: BrokerWalletFilters, overrides: Partial<BrokerWalletFilters> = {}) {
  return `/clientes?${serializeBrokerWalletFilters({ ...filters, ...overrides })}`;
}

/** Mudar de visão: volta à página 1 e mantém só o que vale em todas (busca e origem). */
export function brokerWalletViewHref(filters: BrokerWalletFilters, view: BrokerWalletView) {
  return `/clientes?${serializeBrokerWalletFilters({
    view,
    page: 1,
    ...(filters.query ? { query: filters.query } : {}),
    ...(filters.origin ? { origin: filters.origin } : {}),
  })}`;
}

export function hasBrokerWalletNarrowing(filters: BrokerWalletFilters) {
  return Boolean(filters.query || filters.origin || filters.stage || filters.contractStatus || filters.returnStatus);
}
