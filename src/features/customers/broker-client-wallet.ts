import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
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
  filters: BrokerClientWalletFilters;
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

type WalletContractSnapshot = {
  status: string;
  renewalStatus: string;
  renewalWindowStartDate: string | null;
  expirationDate: string | null;
  updatedAt: Date;
};

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

export function resolveBrokerClientWalletFilters(
  filters: BrokerClientWalletFilters,
  hasRenewalData: boolean,
): BrokerClientWalletFilters {
  return filters.view === "renewals" && !hasRenewalData ? { ...filters, view: "all" } : filters;
}

export function shouldUseBrokerClientWalletLite(input: {
  isLightBroker: boolean;
  flagEnabled: boolean;
}) {
  return input.isLightBroker && input.flagEnabled;
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

export function isBrokerClientWalletRenewalEligible(
  contract: Pick<WalletContractSnapshot, "status" | "renewalStatus" | "expirationDate">,
  now: Date,
) {
  const eligibleStatus = contract.renewalStatus === "pending_window" || contract.renewalStatus === "in_renewal";
  return contract.status === "active" && eligibleStatus && Boolean(contract.expirationDate && contract.expirationDate >= dateKeyInSaoPaulo(now));
}

export function hasBrokerClientWalletRenewalAttention(
  contract: WalletContractSnapshot,
  now: Date,
) {
  return isBrokerClientWalletRenewalEligible(contract, now)
    && Boolean(contract.renewalWindowStartDate && contract.renewalWindowStartDate <= renewalCutoff(now));
}

export function chooseBrokerClientWalletContract<T extends Pick<WalletContractSnapshot, "status" | "updatedAt">>(
  contracts: readonly T[],
  preferredStatus?: BrokerClientContractFilter,
): T | null {
  const ordered = [...contracts].sort((left, right) => {
    const activePriority = Number(right.status === "active") - Number(left.status === "active");
    return activePriority || right.updatedAt.getTime() - left.updatedAt.getTime();
  });
  return (preferredStatus ? ordered.find((contract) => contract.status === preferredStatus) : ordered[0]) ?? null;
}

export function classifyBrokerClientReturn(dueAt: Date | null, now: Date): BrokerClientReturnFilter {
  if (!dueAt) return "none";
  if (dueAt < now) return "overdue";
  return dueAt < getSaoPauloDayBounds(now).end ? "today" : "future";
}

export function chooseBrokerClientWalletTask(
  tasks: readonly BrokerClientWalletTask[],
  returnStatus: BrokerClientReturnFilter | undefined,
  now: Date,
): BrokerClientWalletTask | null {
  return tasks.find((task) => !returnStatus || classifyBrokerClientReturn(task.dueAt, now) === returnStatus) ?? null;
}

function openTaskExists(context: WalletContext, due?: SQL) {
  const conditions = [
    eq(schema.leadTasks.tenantId, context.tenantId),
    eq(schema.leadTasks.assignedTo, context.userId),
    isNull(schema.leadTasks.completedAt),
    due,
  ];
  return sql`${schema.clients.leadId} in (select ${schema.leadTasks.leadId} from ${schema.leadTasks} where ${and(...conditions)})`;
}

function activeContractExists(context: WalletContext, options?: {
  status?: BrokerClientContractFilter;
  renewalBy?: string;
  hasRenewalDate?: boolean;
  renewalEligibleOn?: string;
}) {
  const conditions = [
    eq(schema.activeCustomers.tenantId, context.tenantId),
    options?.status ? eq(schema.activeCustomers.status, options.status) : undefined,
    options?.renewalBy ? lte(schema.activeCustomers.renewalWindowStartDate, options.renewalBy) : undefined,
    options?.hasRenewalDate ? isNotNull(schema.activeCustomers.renewalWindowStartDate) : undefined,
    options?.renewalEligibleOn ? inArray(schema.activeCustomers.renewalStatus, ["pending_window", "in_renewal"]) : undefined,
    options?.renewalEligibleOn ? gte(schema.activeCustomers.expirationDate, options.renewalEligibleOn) : undefined,
  ];
  return sql`${schema.clients.id} in (select ${schema.activeCustomers.clientId} from ${schema.activeCustomers} where ${and(...conditions)})`;
}

function leadOriginExists(context: WalletContext, origin: string) {
  return sql`${schema.clients.leadId} in (select ${schema.leads.id} from ${schema.leads} where ${and(
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
    sql`${schema.clients.leadId} in (select ${schema.leads.id} from ${schema.leads} where ${eq(schema.leads.tenantId, context.tenantId)})`,
  ];

  if (filters.query) {
    const digits = filters.query.replace(/\D/g, "");
    const matches = [sql`position(lower(${filters.query}) in lower(${schema.clients.nome})) > 0`];
    if (digits.length >= 4 && /^[+\d().\s-]+$/.test(filters.query)) {
      matches.push(sql`position(${digits} in regexp_replace(${schema.clients.telefone}, '[^0-9]', '', 'g')) > 0`);
    }
    conditions.push(or(...matches));
  }
  if (filters.origin) conditions.push(leadOriginExists(context, filters.origin));
  if (filters.contractStatus) conditions.push(activeContractExists(context, { status: filters.contractStatus }));

  const bounds = getSaoPauloDayBounds(now);
  const dueTodayOrEarlier = lt(schema.leadTasks.dueAt, bounds.end);
  const today = dateKeyInSaoPaulo(now);
  const attentionRenewal = activeContractExists(context, {
    status: "active",
    renewalBy: renewalCutoff(now),
    renewalEligibleOn: today,
  });
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
        gte(schema.leadTasks.dueAt, now),
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

export async function getBrokerClientWallet(
  context: WalletContext,
  rawFilters: Partial<BrokerClientWalletFilters>,
  now = new Date(),
): Promise<BrokerClientWalletResult> {
  const filters = normalizeBrokerClientWalletFilters(rawFilters);
  if (context.role !== "broker") {
    return { filters, rows: [], page: 1, pageSize: BROKER_CLIENT_WALLET_PAGE_SIZE, totalPages: 0, totalCount: 0, walletCount: 0, counts: { all: 0, attention: 0, renewals: 0 }, hasRenewalData: false, origins: [] };
  }

  const common = { ...filters, view: "all" as const };
  const db = getDatabase();
  const scopeFilters = normalizeBrokerClientWalletFilters({ view: "all", page: 1 });
  const [aggregates, origins] = await Promise.all([
    db.select({
      walletCount: count(),
      selectedCount: sql<number>`count(*) filter (where ${buildBrokerClientWalletWhere(context, filters, now)})`,
      allCount: sql<number>`count(*) filter (where ${buildBrokerClientWalletWhere(context, common, now)})`,
      attentionCount: sql<number>`count(*) filter (where ${buildBrokerClientWalletWhere(context, { ...common, view: "attention" }, now)})`,
      renewalCount: sql<number>`count(*) filter (where ${buildBrokerClientWalletWhere(context, { ...common, view: "renewals" }, now)})`,
      renewalDataCount: sql<number>`count(*) filter (where ${activeContractExists(context, {
        status: "active",
        hasRenewalDate: true,
        renewalEligibleOn: dateKeyInSaoPaulo(now),
      })})`,
    })
      .from(schema.clients)
      .where(buildBrokerClientWalletWhere(context, scopeFilters, now)),
    db.selectDistinct({ origin: schema.leads.origem })
      .from(schema.leads)
      .innerJoin(schema.clients, and(eq(schema.clients.leadId, schema.leads.id), eq(schema.clients.tenantId, schema.leads.tenantId)))
      .where(and(buildClientScopeWhere(context), eq(schema.leads.tenantId, context.tenantId), isNotNull(schema.leads.origem)))
      .orderBy(asc(schema.leads.origem)),
  ]);

  const counts = aggregates[0];
  const walletCount = Number(counts?.walletCount ?? 0);
  const allCount = Number(counts?.allCount ?? 0);
  const attentionCount = Number(counts?.attentionCount ?? 0);
  const renewalCount = Number(counts?.renewalCount ?? 0);
  const renewalDataCount = Number(counts?.renewalDataCount ?? 0);
  const hasRenewalData = shouldExposeBrokerRenewalsTab(renewalDataCount);
  const effectiveFilters = resolveBrokerClientWalletFilters(filters, hasRenewalData);
  const selectedCount = effectiveFilters.view === filters.view
    ? Number(counts?.selectedCount ?? 0)
    : allCount;

  const totalPages = Math.ceil(selectedCount / BROKER_CLIENT_WALLET_PAGE_SIZE);
  const page = totalPages > 0 ? Math.min(effectiveFilters.page, totalPages) : 1;
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
    .where(buildBrokerClientWalletWhere(context, effectiveFilters, now))
    .orderBy(desc(schema.clients.convertedAt), desc(schema.clients.id))
    .limit(BROKER_CLIENT_WALLET_PAGE_SIZE)
    .offset((page - 1) * BROKER_CLIENT_WALLET_PAGE_SIZE);

  const clientIds = clients.map((client) => client.id);
  const leadIds = clients.map((client) => client.leadId);
  const [contracts, tasks] = clientIds.length
    ? await Promise.all([
      db.select({
        clientId: schema.activeCustomers.clientId,
        status: schema.activeCustomers.status,
        renewalStatus: schema.activeCustomers.renewalStatus,
        renewalWindowStartDate: schema.activeCustomers.renewalWindowStartDate,
        expirationDate: schema.activeCustomers.expirationDate,
        updatedAt: schema.activeCustomers.updatedAt,
      })
        .from(schema.activeCustomers)
        .where(and(eq(schema.activeCustomers.tenantId, context.tenantId), inArray(schema.activeCustomers.clientId, clientIds)))
        .orderBy(desc(sql`case when ${schema.activeCustomers.status} = 'active' then 1 else 0 end`), desc(schema.activeCustomers.updatedAt)),
      db.select({ id: schema.leadTasks.id, leadId: schema.leadTasks.leadId, title: schema.leadTasks.title, dueAt: schema.leadTasks.dueAt, priority: schema.leadTasks.priority })
        .from(schema.leadTasks)
        .where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.assignedTo, context.userId), inArray(schema.leadTasks.leadId, leadIds), isNull(schema.leadTasks.completedAt)))
        .orderBy(sql`${schema.leadTasks.dueAt} asc nulls last`, desc(schema.leadTasks.createdAt)),
    ])
    : [[], []] as const;

  const contractsByClient = new Map<string, WalletContractSnapshot[]>();
  for (const contract of contracts) {
    if (!contract.clientId) continue;
    const snapshots = contractsByClient.get(contract.clientId) ?? [];
    snapshots.push(contract);
    contractsByClient.set(contract.clientId, snapshots);
  }
  const tasksByLead = new Map<string, BrokerClientWalletTask[]>();
  for (const task of tasks) {
    const leadTasks = tasksByLead.get(task.leadId) ?? [];
    leadTasks.push(task);
    tasksByLead.set(task.leadId, leadTasks);
  }

  const rows = clients.map((client) => {
    const clientContracts = contractsByClient.get(client.id) ?? [];
    const displayContract = chooseBrokerClientWalletContract(clientContracts, effectiveFilters.contractStatus);
    const renewalContract = clientContracts.find((contract) => hasBrokerClientWalletRenewalAttention(contract, now));
    const nextTask = chooseBrokerClientWalletTask(tasksByLead.get(client.leadId) ?? [], effectiveFilters.returnStatus, now);
    const returnBucket = classifyBrokerClientReturn(nextTask?.dueAt ?? null, now);
    const contractStatus: BrokerClientWalletRow["contractStatus"] = displayContract?.status === "active"
      ? "active"
      : displayContract?.status === "cancelled"
        ? "cancelled"
        : null;
    return {
      ...client,
      contractStatus,
      renewalWindowStartDate: displayContract?.renewalWindowStartDate ?? null,
      nextTask,
      attentionReason: returnBucket === "overdue"
        ? "overdue_return" as const
        : returnBucket === "today"
          ? "today_return" as const
          : renewalContract
            ? "renewal" as const
            : null,
    };
  });
  return {
    filters: effectiveFilters,
    rows,
    page,
    pageSize: BROKER_CLIENT_WALLET_PAGE_SIZE,
    totalPages,
    totalCount: selectedCount,
    walletCount,
    counts: { all: allCount, attention: attentionCount, renewals: renewalCount },
    hasRenewalData,
    origins: origins.flatMap(({ origin }) => origin ? [origin] : []),
  };
}
