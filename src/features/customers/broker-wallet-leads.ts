import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull, not, ilike, or, sql, type SQL } from "drizzle-orm";

import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import {
  BROKER_WALLET_NEGOTIATING_STAGES,
  type BrokerWalletFilters,
  type BrokerWalletLeadView,
  type BrokerWalletOrigin,
  type BrokerWalletStage,
} from "./broker-wallet-filters";

export const BROKER_WALLET_LEADS_PAGE_SIZE = 20;

export type BrokerWalletLeadFilters = {
  view: BrokerWalletLeadView;
  page: number;
  query?: string;
  origin?: BrokerWalletOrigin;
  stage?: BrokerWalletStage;
};

export type BrokerWalletLeadRow = {
  id: string;
  name: string;
  phone: string;
  status: string;
  origin: string;
  archived: boolean;
  updatedAt: Date;
  nextTask: { id: string; title: string; dueAt: Date | null } | null;
};

export type BrokerWalletLeadsResult = {
  view: BrokerWalletLeadView;
  rows: BrokerWalletLeadRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  counts: Record<BrokerWalletLeadView, number>;
  origins: string[];
};

type WalletContext = Pick<TenantContext, "tenantId" | "userId" | "role" | "branchId" | "jobTitle"> & Partial<TenantContext>;

/** Placeholder de conversa sem nome (a fila do corretor também esconde). */
const PLACEHOLDER_NAME = "Lead WhatsApp (%)";

function viewCondition(view: BrokerWalletLeadView, stage?: BrokerWalletStage): SQL {
  if (view === "negotiating") {
    const stages = stage && (BROKER_WALLET_NEGOTIATING_STAGES as readonly string[]).includes(stage)
      ? [stage as (typeof BROKER_WALLET_NEGOTIATING_STAGES)[number]]
      : [...BROKER_WALLET_NEGOTIATING_STAGES];
    return and(isNull(schema.leads.archivedAt), inArray(schema.leads.status, stages))!;
  }
  if (stage === "lost") return eq(schema.leads.status, "lost");
  if (stage === "archived") return isNotNull(schema.leads.archivedAt);
  return or(eq(schema.leads.status, "lost"), isNotNull(schema.leads.archivedAt))!;
}

/**
 * O predicado único da lista e das contagens de leads da carteira. O escopo é sempre o canônico
 * (`buildLeadScopeWhere`: tenant e corretor da sessão); papel diferente de corretor não vê nada.
 */
export function buildBrokerWalletLeadWhere(context: WalletContext, filters: Omit<BrokerWalletLeadFilters, "page">): SQL {
  if (context.role !== "broker") return sql`false`;
  const conditions: (SQL | undefined)[] = [
    buildLeadScopeWhere(context as TenantContext),
    eq(schema.leads.tenantId, context.tenantId),
    eq(schema.leads.corretorId, context.userId),
    isNull(schema.leads.deletedAt),
    not(ilike(schema.leads.nome, PLACEHOLDER_NAME)),
    viewCondition(filters.view, filters.stage),
  ];
  if (filters.query) {
    const digits = filters.query.replace(/\D/g, "");
    const matches = [sql`position(lower(${filters.query}) in lower(${schema.leads.nome})) > 0`];
    if (digits.length >= 4 && /^[+\d().\s-]+$/.test(filters.query)) {
      matches.push(sql`position(${digits} in regexp_replace(${schema.leads.telefone}, '[^0-9]', '', 'g')) > 0`);
    }
    conditions.push(or(...matches));
  }
  if (filters.origin) conditions.push(eq(schema.leads.origem, filters.origin));
  return and(...conditions)!;
}

export function toBrokerWalletLeadFilters(filters: BrokerWalletFilters, view: BrokerWalletLeadView): BrokerWalletLeadFilters {
  return {
    view,
    page: filters.page,
    ...(filters.query ? { query: filters.query } : {}),
    ...(filters.origin ? { origin: filters.origin } : {}),
    ...(filters.view === view && filters.stage ? { stage: filters.stage } : {}),
  };
}

/**
 * Leads do corretor para "Em negociação" e "Arquivados", paginados no servidor. Com `rows: false` só conta
 * (para os números das outras visões). Contagens respeitam busca e origem, não a situação da visão atual.
 */
export async function getBrokerWalletLeads(
  context: WalletContext,
  filters: BrokerWalletLeadFilters,
  options: { rows?: boolean } = {},
): Promise<BrokerWalletLeadsResult> {
  const empty: BrokerWalletLeadsResult = {
    view: filters.view, rows: [], page: 1, pageSize: BROKER_WALLET_LEADS_PAGE_SIZE, totalPages: 0, totalCount: 0,
    counts: { negotiating: 0, archived: 0 }, origins: [],
  };
  if (context.role !== "broker") return empty;

  const db = getDatabase();
  const common = { query: filters.query, origin: filters.origin };
  const [aggregates] = await db.select({
    selected: sql<number>`count(*) filter (where ${buildBrokerWalletLeadWhere(context, { ...filters })})`,
    negotiating: sql<number>`count(*) filter (where ${buildBrokerWalletLeadWhere(context, { ...common, view: "negotiating" })})`,
    archived: sql<number>`count(*) filter (where ${buildBrokerWalletLeadWhere(context, { ...common, view: "archived" })})`,
    manual: sql<number>`count(*) filter (where ${schema.leads.origem} = 'manual')`,
    webhook: sql<number>`count(*) filter (where ${schema.leads.origem} = 'webhook')`,
  })
    .from(schema.leads)
    .where(and(
      buildLeadScopeWhere(context as TenantContext),
      eq(schema.leads.tenantId, context.tenantId),
      eq(schema.leads.corretorId, context.userId),
      isNull(schema.leads.deletedAt),
    ));

  const counts = {
    negotiating: Number(aggregates?.negotiating ?? 0),
    archived: Number(aggregates?.archived ?? 0),
  };
  const origins = [
    ...(Number(aggregates?.manual ?? 0) > 0 ? ["manual"] : []),
    ...(Number(aggregates?.webhook ?? 0) > 0 ? ["webhook"] : []),
  ];
  const totalCount = Number(aggregates?.selected ?? 0);
  const totalPages = Math.ceil(totalCount / BROKER_WALLET_LEADS_PAGE_SIZE);
  const page = totalPages > 0 ? Math.min(filters.page, totalPages) : 1;
  if (options.rows === false) return { ...empty, counts, origins, totalCount, totalPages, page };

  const leads = await db.select({
    id: schema.leads.id,
    name: schema.leads.nome,
    phone: schema.leads.telefone,
    status: schema.leads.status,
    origin: schema.leads.origem,
    archivedAt: schema.leads.archivedAt,
    updatedAt: schema.leads.updatedAt,
  })
    .from(schema.leads)
    .where(buildBrokerWalletLeadWhere(context, filters))
    .orderBy(desc(schema.leads.updatedAt), desc(schema.leads.id))
    .limit(BROKER_WALLET_LEADS_PAGE_SIZE)
    .offset((page - 1) * BROKER_WALLET_LEADS_PAGE_SIZE);

  const leadIds = leads.map((lead) => lead.id);
  const tasks = leadIds.length && filters.view === "negotiating"
    ? await db.select({ id: schema.leadTasks.id, leadId: schema.leadTasks.leadId, title: schema.leadTasks.title, dueAt: schema.leadTasks.dueAt })
      .from(schema.leadTasks)
      .where(and(
        eq(schema.leadTasks.tenantId, context.tenantId),
        eq(schema.leadTasks.assignedTo, context.userId),
        inArray(schema.leadTasks.leadId, leadIds),
        isNull(schema.leadTasks.completedAt),
      ))
      .orderBy(sql`${schema.leadTasks.dueAt} asc nulls last`, desc(schema.leadTasks.createdAt))
    : [];
  const nextTaskByLead = new Map<string, BrokerWalletLeadRow["nextTask"]>();
  for (const task of tasks) {
    if (!nextTaskByLead.has(task.leadId)) nextTaskByLead.set(task.leadId, { id: task.id, title: task.title, dueAt: task.dueAt });
  }

  return {
    view: filters.view,
    rows: leads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      origin: lead.origin,
      archived: Boolean(lead.archivedAt),
      updatedAt: lead.updatedAt,
      nextTask: nextTaskByLead.get(lead.id) ?? null,
    })),
    page,
    pageSize: BROKER_WALLET_LEADS_PAGE_SIZE,
    totalPages,
    totalCount,
    counts,
    origins,
  };
}
