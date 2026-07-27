import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export async function getQuoteByToken(token: string) {
  const [quote] = await getDatabase()
    .select({
      id: schema.quotes.id,
      leadId: schema.quotes.leadId,
      status: schema.quotes.status,
      lives: schema.quotes.lives,
      notes: schema.quotes.notes,
      publicToken: schema.quotes.publicToken,
      sharedAt: schema.quotes.sharedAt,
      leadName: schema.quotes.leadName,
      leadPhone: schema.quotes.leadPhone,
      totalMonthly: schema.quotes.totalMonthly,
      beneficiaryCount: schema.quotes.beneficiaryCount,
      createdAt: schema.quotes.createdAt,
    })
    .from(schema.quotes)
    .where(eq(schema.quotes.publicToken, token))
    .limit(1);

  if (!quote) return null;

  const items = await getDatabase()
    .select({
      id: schema.quoteItems.id,
      planId: schema.quoteItems.planId,
      monthlyPrice: schema.quoteItems.monthlyPrice,
      recommended: schema.quoteItems.recommended,
      snapshot: schema.quoteItems.snapshot,
    })
    .from(schema.quoteItems)
    .where(eq(schema.quoteItems.quoteId, quote.id));

  const lineItems = await getDatabase()
    .select({
      id: schema.quoteLineItems.id,
      beneficiaryId: schema.quoteLineItems.beneficiaryId,
      planId: schema.quoteLineItems.planId,
      calculatedValue: schema.quoteLineItems.calculatedValue,
      ageAtQuote: schema.quoteLineItems.ageAtQuote,
      snapshot: schema.quoteLineItems.snapshot,
    })
    .from(schema.quoteLineItems)
    .where(eq(schema.quoteLineItems.quoteId, quote.id));

  return { ...quote, items, lineItems };
}

export async function getQuotesByLead(leadId: string) {
  const context = await getRequiredTenantContext();

  const quotes = await getDatabase()
    .select({
      id: schema.quotes.id,
      status: schema.quotes.status,
      totalMonthly: schema.quotes.totalMonthly,
      beneficiaryCount: schema.quotes.beneficiaryCount,
      publicToken: schema.quotes.publicToken,
      sharedAt: schema.quotes.sharedAt,
      createdAt: schema.quotes.createdAt,
    })
    .from(schema.quotes)
    .where(and(eq(schema.quotes.tenantId, context.tenantId), eq(schema.quotes.leadId, leadId)))
    .orderBy(desc(schema.quotes.createdAt));

  return quotes;
}

export async function getMessageTemplates(category?: string) {
  const context = await getRequiredTenantContext();

  const conditions = [
    eq(schema.messageTemplates.tenantId, context.tenantId),
    eq(schema.messageTemplates.active, true),
  ];

  if (category) {
    conditions.push(eq(schema.messageTemplates.category, category));
  }

  return getDatabase()
    .select({
      id: schema.messageTemplates.id,
      name: schema.messageTemplates.name,
      category: schema.messageTemplates.category,
      content: schema.messageTemplates.content,
      variables: schema.messageTemplates.variables,
    })
    .from(schema.messageTemplates)
    .where(and(...conditions))
    .orderBy(schema.messageTemplates.name);
}
