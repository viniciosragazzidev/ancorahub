import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { isBrokerPriorClientsFlagOn } from "./broker-my-wallet-flag";
import { isPriorPortfolioSchemaReady, portfolioClients } from "./prior-portfolio-schema";

type Ctx = Pick<TenantContext, "tenantId" | "userId" | "role" | "branchId" | "jobTitle"> & Partial<TenantContext>;

/** Chave ligada (sobre a Minha carteira) e migration 0231 aplicada. Falha conta como desligada. */
export async function isBrokerPriorClientsEnabled(): Promise<boolean> {
  if (!(await isBrokerPriorClientsFlagOn().catch(() => false))) return false;
  return isPriorPortfolioSchemaReady();
}

/** Hoje em São Paulo, no formato das colunas `date`. */
export function saoPauloDateKey(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const digitsOf = (column: unknown) => sql`regexp_replace(${column}, '[^0-9]', '', 'g')`;

export type PriorDuplicate = { mine: true; href: string; name: string } | { mine: false } | null;

/**
 * Duplicidade por telefone. Primeiro no escopo do corretor (clientes dele e leads do escopo canônico); se o
 * telefone só existir fora desse escopo, devolve apenas `{ mine: false }`, sem nome nem responsável.
 */
export async function findPriorPortfolioDuplicate(context: Ctx, telefone: string): Promise<PriorDuplicate> {
  const db = getDatabase();
  const [ownClient] = await db.select({ id: schema.clients.id, name: schema.clients.nome })
    .from(schema.clients)
    .where(and(eq(schema.clients.tenantId, context.tenantId), eq(schema.clients.corretorId, context.userId), sql`${digitsOf(schema.clients.telefone)} = ${telefone}`))
    .orderBy(asc(schema.clients.createdAt))
    .limit(1);
  if (ownClient) return { mine: true, href: `/clientes/${encodeURIComponent(ownClient.id)}`, name: ownClient.name };

  const [ownLead] = await db.select({ id: schema.leads.id, name: schema.leads.nome })
    .from(schema.leads)
    .where(and(buildLeadScopeWhere(context as TenantContext), eq(schema.leads.corretorId, context.userId), isNull(schema.leads.deletedAt), sql`${digitsOf(schema.leads.telefone)} = ${telefone}`))
    .limit(1);
  if (ownLead) return { mine: true, href: `/leads/${encodeURIComponent(ownLead.id)}`, name: ownLead.name };

  const [elsewhere] = await db.select({ found: sql<number>`1` })
    .from(schema.clients)
    .where(and(eq(schema.clients.tenantId, context.tenantId), sql`${digitsOf(schema.clients.telefone)} = ${telefone}`))
    .limit(1);
  if (elsewhere) return { mine: false };
  const [leadElsewhere] = await db.select({ found: sql<number>`1` })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), sql`${digitsOf(schema.leads.telefone)} = ${telefone}`))
    .limit(1);
  return leadElsewhere ? { mine: false } : null;
}

/** Cliente de carteira anterior do próprio corretor (tenant e corretor da sessão); outro dono ou venda devolve null. */
export async function loadOwnPriorClient(context: Ctx, clientId: string) {
  if (context.role !== "broker") return null;
  const [client] = await getDatabase().select({
    id: portfolioClients.id,
    name: portfolioClients.nome,
    phone: portfolioClients.telefone,
    email: portfolioClients.email,
    originNote: portfolioClients.originNote,
    branchId: portfolioClients.branchId,
    createdAt: portfolioClients.convertedAt,
  })
    .from(portfolioClients)
    .where(and(
      eq(portfolioClients.id, clientId),
      eq(portfolioClients.tenantId, context.tenantId),
      eq(portfolioClients.corretorId, context.userId),
      eq(portfolioClients.source, "prior_portfolio"),
    ))
    .limit(1);
  return client ?? null;
}

export type PriorContractView = {
  id: string;
  productType: string;
  carrierName: string | null;
  coverageStartDate: string | null;
  renewalDate: string | null;
  status: string;
};

export async function listPriorContracts(context: Ctx, clientIds: string[]): Promise<(PriorContractView & { clientId: string })[]> {
  if (!clientIds.length) return [];
  return getDatabase().select({
    id: schema.clientPriorContracts.id,
    clientId: schema.clientPriorContracts.clientId,
    productType: schema.clientPriorContracts.productType,
    carrierName: schema.clientPriorContracts.carrierName,
    coverageStartDate: schema.clientPriorContracts.coverageStartDate,
    renewalDate: schema.clientPriorContracts.renewalDate,
    status: schema.clientPriorContracts.status,
  })
    .from(schema.clientPriorContracts)
    .where(and(
      eq(schema.clientPriorContracts.tenantId, context.tenantId),
      eq(schema.clientPriorContracts.brokerId, context.userId),
      inArray(schema.clientPriorContracts.clientId, clientIds),
    ))
    .orderBy(sql`${schema.clientPriorContracts.renewalDate} asc nulls last`, asc(schema.clientPriorContracts.createdAt));
}
