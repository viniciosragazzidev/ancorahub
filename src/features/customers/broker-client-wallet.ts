import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { buildClientScopeWhere } from "@/features/customers/customer-authorization";
import { getSaoPauloDayBounds } from "@/features/broker-workspace/workspace-data-domain";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export const BROKER_CLIENT_WALLET_PAGE_SIZE = 20;
export const BROKER_CLIENT_WALLET_MAX_PAGE = 50_000;
export const BROKER_CLIENT_WALLET_RENEWAL_WINDOW_DAYS = 30;

export type BrokerClientWalletView = "all" | "attention" | "renewals";
export type BrokerClientReturnFilter = "overdue" | "today" | "future" | "none";
export type BrokerClientContractFilter = "active" | "cancelled";

export type BrokerClientWalletFilters = {
  view: BrokerClientWalletView;
  page: number;
  query?: string;
  origin?: string;
  contractStatus?: BrokerClientContractFilter;
  returnStatus?: BrokerClientReturnFilter;
};

export type BrokerClientWalletTask = {
  id: string;
  title: string;
  dueAt: Date | null;
  priority: "low" | "normal" | "urgent";
};

export type BrokerClientWalletRow = {
  id: string;
  leadId: string;
  name: string;
  phone: string | null;
  email: string | null;
  convertedAt: Date;
  origin: string | null;
  contractStatus: "active" | "cancelled" | null;
  renewalWindowStartDate: string | null;
  nextTask: BrokerClientWalletTask | null;
  attentionReason: "overdue_return" | "today_return" | "renewal" | null;
};

export type BrokerClientWalletResult = {
  rows: BrokerClientWalletRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  walletCount: number;
  counts: Record<BrokerClientWalletView, number>;
  hasRenewalData: boolean;
  origins: string[];
};

type WalletContext = Pick<TenantContext, "tenantId" | "userId" | "role" | "branchId" | "jobTitle"> & Partial<TenantContext>;

export function clampBrokerWalletPage(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(BROKER_CLIENT_WALLET_MAX_PAGE, Math.max(1, Math.trunc(parsed)));
}

export function normalizeBrokerClientWalletFilters(
  input: Partial<BrokerClientWalletFilters>,
): BrokerClientWalletFilters {
  const query = input.query?.trim().slice(0, 100) ?? "";
  const requestedOrigin = input.origin?.trim();
  const origin = requestedOrigin === "manual" || requestedOrigin === "webhook" ? requestedOrigin : "";
  return {
    view: input.view === "attention" || input.view === "renewals" ? input.view : "all",
    page: clampBrokerWalletPage(input.page),
    ...(query ? { query } : {}),
    ...(origin ? { origin } : {}),
    ...(input.contractStatus === "active" || input.contractStatus === "cancelled" ? { contractStatus: input.contractStatus } : {}),
    ...(input.returnStatus === "overdue" || input.returnStatus === "today" || input.returnStatus === "future" || input.returnStatus === "none"
      ? { returnStatus: input.returnStatus }
      : {}),
  };
}

export function shouldExposeBrokerRenewalsTab(activeContractsWithRenewalDate: number) {
  return activeContractsWithRenewalDate > 0;
}

function dateKeyInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addCalendarDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function renewalCutoff(now: Date) {
  return addCalendarDays(dateKeyInSaoPaulo(now), BROKER_CLIENT_WALLET_RENEWAL_WINDOW_DAYS);
}

function openTaskExists(context: WalletContext, due?: SQL) {
  const conditions = [
    eq(schema.leadTasks.tenantId, context.tenantId),
    eq(schema.leadTasks.leadId, schema.clients.leadId),
    eq(schema.leadTasks.assignedTo, context.userId),
    isNull(schema.leadTasks.completedAt),
    due,
  ];
  return sql`exists (select 1 from ${schema.leadTasks} where ${and(...conditions)})`;
}

function activeContractExists(context: WalletContext, options?: { status?: BrokerClientContractFilter; renewalBy?: string; hasRenewalDate?: boolean }) {
  const conditions = [
    eq(schema.activeCustomers.tenantId, context.tenantId),
    eq(schema.activeCustomers.clientId, schema.clients.id),
    options?.status ? eq(schema.activeCustomers.status, options.status) : undefined,
    options?.renewalBy ? lte(schema.activeCustomers.renewalWindowStartDate, options.renewalBy) : undefined,
    options?.hasRenewalDate ? isNotNull(schema.activeCustomers.renewalWindowStartDate) : undefined,
  ];
  return sql`exists (select 1 from ${schema.activeCustomers} where ${and(...conditions)})`;
}

function leadOriginExists(context: WalletContext, origin: string) {
  return sql`exists (select 1 from ${schema.leads} where ${and(
    eq(schema.leads.id, schema.clients.leadId),
    eq(schema.leads.tenantId, context.tenantId),
    eq(schema.leads.origem, origin as "manual" | "webhook"),
  )})`;
}

/**
 * The single predicate builder for the wallet list and every matching count.
 * The base client scope is always derived from the authenticated server context.
 */
export function buildBrokerClientWalletWhere(
  context: WalletContext,
  filters: BrokerClientWalletFilters,
  now: Date,
): SQL {
  if (context.role !== "broker") return sql`false`;

  const conditions: (SQL | undefined)[] = [
    buildClientScopeWhere(context),
    eq(schema.clients.tenantId, context.tenantId),
    sql`exists (select 1 from ${schema.leads} where ${schema.leads.id} = ${schema.clients.leadId} and ${schema.leads.tenantId} = ${context.tenantId})`,
  ];

  if (filters.query) {
    const digits = filters.query.replace(/\D/g, "");
    const matches = [sql`position(lower(${filters.query}) in lower(${schema.clients.nome})) > 0`];
    if (digits) matches.push(sql`position(${digits} in regexp_replace(${schema.clients.telefone}, '[^0-9]', '', 'g')) > 0`);
    conditions.push(or(...matches));
  }
  if (filters.origin) conditions.push(leadOriginExists(context, filters.origin));
  if (filters.contractStatus) conditions.push(activeContractExists(context, { status: filters.contractStatus }));

  const bounds = getSaoPauloDayBounds(now);
  const dueTodayOrEarlier = lt(schema.leadTasks.dueAt, bounds.end);
  const attentionRenewal = activeContractExists(context, { status: "active", renewalBy: renewalCutoff(now) });
  const attentionReturn = openTaskExists(context, dueTodayOrEarlier);

  if (filters.view === "attention") conditions.push(or(attentionReturn, attentionRenewal));
  if (filters.view === "renewals") conditions.push(attentionRenewal);

  switch (filters.returnStatus) {
    case "overdue":
      conditions.push(openTaskExists(context, and(isNotNull(schema.leadTasks.dueAt), lt(schema.leadTasks.dueAt, now))!));
      break;
    case "today":
      conditions.push(openTaskExists(context, and(
        isNotNull(schema.leadTasks.dueAt),
        sql`${schema.leadTasks.dueAt} >= ${bounds.start}`,
        lt(schema.leadTasks.dueAt, bounds.end),
      )!));
      break;
    case "future":
      conditions.push(openTaskExists(context, and(isNotNull(schema.leadTasks.dueAt), sql`${schema.leadTasks.dueAt} >= ${bounds.end}`)!));
      break;
    case "none":
      conditions.push(not(openTaskExists(context, isNotNull(schema.leadTasks.dueAt))));
      break;
  }

  return and(...conditions)!;
}

async function countClients(context: WalletContext, filters: BrokerClientWalletFilters, now: Date) {
  const [result] = await getDatabase()
    .select({ value: count() })
    .from(schema.clients)
    .where(buildBrokerClientWalletWhere(context, filters, now));
  return Number(result?.value ?? 0);
}

export async function getBrokerClientWallet(
  context: WalletContext,
  rawFilters: Partial<BrokerClientWalletFilters>,
  now = new Date(),
): Promise<BrokerClientWalletResult> {
  const filters = normalizeBrokerClientWalletFilters(rawFilters);
  if (context.role !== "broker") {
    return { rows: [], page: 1, pageSize: BROKER_CLIENT_WALLET_PAGE_SIZE, totalPages: 0, totalCount: 0, walletCount: 0, counts: { all: 0, attention: 0, renewals: 0 }, hasRenewalData: false, origins: [] };
  }

  const common = { ...filters, view: "all" as const };
  const db = getDatabase();
  const [
    selectedCount,
    walletCount,
    allCount,
    attentionCount,
    renewalCount,
    renewalDataCount,
    origins,
  ] = await Promise.all([
    countClients(context, filters, now),
    countClients(context, { ...common, query: undefined, origin: undefined, contractStatus: undefined, returnStatus: undefined }, now),
    countClients(context, common, now),
    countClients(context, { ...common, view: "attention" }, now),
    countClients(context, { ...common, view: "renewals" }, now),
    db.select({ value: count() }).from(schema.activeCustomers)
      .innerJoin(schema.clients, and(eq(schema.activeCustomers.clientId, schema.clients.id), eq(schema.activeCustomers.tenantId, schema.clients.tenantId)))
      .where(and(
        buildClientScopeWhere(context),
        eq(schema.activeCustomers.tenantId, context.tenantId),
        eq(schema.activeCustomers.status, "active"),
        isNotNull(schema.activeCustomers.renewalWindowStartDate),
      ))
      .then(([result]) => Number(result?.value ?? 0)),
    db.selectDistinct({ origin: schema.leads.origem })
      .from(schema.leads)
      .innerJoin(schema.clients, and(eq(schema.clients.leadId, schema.leads.id), eq(schema.clients.tenantId, schema.leads.tenantId)))
      .where(and(buildClientScopeWhere(context), eq(schema.leads.tenantId, context.tenantId), isNotNull(schema.leads.origem)))
      .orderBy(asc(schema.leads.origem)),
  ]);

  const totalPages = Math.ceil(selectedCount / BROKER_CLIENT_WALLET_PAGE_SIZE);
  const page = totalPages > 0 ? Math.min(filters.page, totalPages) : 1;
  const clients = await db.select({
    id: schema.clients.id,
    leadId: schema.clients.leadId,
    name: schema.clients.nome,
    phone: schema.clients.telefone,
    email: schema.clients.email,
    convertedAt: schema.clients.convertedAt,
    origin: schema.leads.origem,
  })
    .from(schema.clients)
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.clients.leadId), eq(schema.leads.tenantId, schema.clients.tenantId)))
    .where(buildBrokerClientWalletWhere(context, filters, now))
    .orderBy(desc(schema.clients.convertedAt), desc(schema.clients.id))
    .limit(BROKER_CLIENT_WALLET_PAGE_SIZE)
    .offset((page - 1) * BROKER_CLIENT_WALLET_PAGE_SIZE);

  const clientIds = clients.map((client) => client.id);
  const leadIds = clients.map((client) => client.leadId);
  const [contracts, tasks] = clientIds.length
    ? await Promise.all([
      db.select({ clientId: schema.activeCustomers.clientId, status: schema.activeCustomers.status, renewalWindowStartDate: schema.activeCustomers.renewalWindowStartDate })
        .from(schema.activeCustomers)
        .where(and(eq(schema.activeCustomers.tenantId, context.tenantId), inArray(schema.activeCustomers.clientId, clientIds)))
        .orderBy(desc(sql`case when ${schema.activeCustomers.status} = 'active' then 1 else 0 end`), desc(schema.activeCustomers.updatedAt)),
      db.select({ id: schema.leadTasks.id, leadId: schema.leadTasks.leadId, title: schema.leadTasks.title, dueAt: schema.leadTasks.dueAt, priority: schema.leadTasks.priority })
        .from(schema.leadTasks)
        .where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.assignedTo, context.userId), inArray(schema.leadTasks.leadId, leadIds), isNull(schema.leadTasks.completedAt)))
        .orderBy(sql`${schema.leadTasks.dueAt} asc nulls last`, desc(schema.leadTasks.createdAt)),
    ])
    : [[], []] as const;

  const contractByClient = new Map<string, { status: "active" | "cancelled" | null; renewalWindowStartDate: string | null }>();
  for (const contract of contracts) {
    if (!contract.clientId || contractByClient.has(contract.clientId)) continue;
    contractByClient.set(contract.clientId, {
      status: contract.status === "active" || contract.status === "cancelled" ? contract.status : null,
      renewalWindowStartDate: contract.renewalWindowStartDate,
    });
  }
  const taskByLead = new Map<string, BrokerClientWalletTask>();
  for (const task of tasks) {
    if (!taskByLead.has(task.leadId)) taskByLead.set(task.leadId, task);
  }

  const rows = clients.map((client) => ({
    ...client,
    contractStatus: contractByClient.get(client.id)?.status ?? null,
    renewalWindowStartDate: contractByClient.get(client.id)?.renewalWindowStartDate ?? null,
    nextTask: taskByLead.get(client.leadId) ?? null,
    attentionReason: (() => {
      const task = taskByLead.get(client.leadId);
      if (task?.dueAt && task.dueAt < now) return "overdue_return" as const;
      if (task?.dueAt && task.dueAt >= getSaoPauloDayBounds(now).start && task.dueAt < getSaoPauloDayBounds(now).end) return "today_return" as const;
      const renewal = contractByClient.get(client.id)?.renewalWindowStartDate;
      if (contractByClient.get(client.id)?.status === "active" && renewal && renewal <= renewalCutoff(now)) return "renewal" as const;
      return null;
    })(),
  }));
  return {
    rows,
    page,
    pageSize: BROKER_CLIENT_WALLET_PAGE_SIZE,
    totalPages,
    totalCount: selectedCount,
    walletCount,
    counts: { all: allCount, attention: attentionCount, renewals: renewalCount },
    hasRenewalData: shouldExposeBrokerRenewalsTab(renewalDataCount),
    origins: origins.flatMap(({ origin }) => origin ? [origin] : []),
  };
}
