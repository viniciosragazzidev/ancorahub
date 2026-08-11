import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

// ─── Company Profile Service ──────────────────────────────────────────────────

export type CompanyProfileInput = {
  tradeName?: string;
  companyName?: string;
  cnpj?: string;
  description?: string;
  segment?: string;
  website?: string;
  phone?: string;
  email?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  positioning?: {
    aboutUs?: string;
    differentials?: string[];
    targetAudience?: string;
    regionsServed?: string[];
    productsOffered?: string[];
    toneOfVoice?: string;
  };
  serviceConfig?: {
    businessHours?: string;
    businessDays?: string;
    channels?: string[];
    slaMinutes?: number;
    supportEmail?: string;
    supportPhone?: string;
  };
  commercialRules?: {
    operators?: string[];
    products?: string[];
    rulesSummary?: string;
  };
};

export async function getCompanyProfile(tenantId: string) {
  const db = getDatabase();
  const [profile] = await db
    .select()
    .from(schema.tenantIntelligenceProfiles)
    .where(eq(schema.tenantIntelligenceProfiles.tenantId, tenantId))
    .limit(1);

  if (profile) return profile;

  // Initialize default profile if not exists
  const id = randomUUID();
  const [created] = await db
    .insert(schema.tenantIntelligenceProfiles)
    .values({
      id,
      tenantId,
      segment: "Planos de Saúde e Odontológicos",
    })
    .returning();

  return created;
}

export async function updateCompanyProfile(tenantId: string, input: CompanyProfileInput) {
  const db = getDatabase();
  const existing = await getCompanyProfile(tenantId);

  const [updated] = await db
    .update(schema.tenantIntelligenceProfiles)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(schema.tenantIntelligenceProfiles.id, existing.id))
    .returning();

  return updated;
}

// ─── Unit Profiles Service ──────────────────────────────────────────────────

export async function getUnitProfiles(tenantId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.unitIntelligenceProfiles)
    .where(eq(schema.unitIntelligenceProfiles.tenantId, tenantId))
    .orderBy(desc(schema.unitIntelligenceProfiles.createdAt));
}

export async function upsertUnitProfile(tenantId: string, input: {
  branchId: string;
  unitName: string;
  managerName?: string;
  managerEmail?: string;
  phone?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  businessHours?: string;
  serviceRegions?: string[];
}) {
  const db = getDatabase();
  const existing = await db
    .select()
    .from(schema.unitIntelligenceProfiles)
    .where(
      and(
        eq(schema.unitIntelligenceProfiles.tenantId, tenantId),
        eq(schema.unitIntelligenceProfiles.branchId, input.branchId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(schema.unitIntelligenceProfiles)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(schema.unitIntelligenceProfiles.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(schema.unitIntelligenceProfiles)
    .values({
      id: randomUUID(),
      tenantId,
      ...input,
    })
    .returning();

  return created;
}

// ─── Knowledge Collections Service ─────────────────────────────────────────

export async function getKnowledgeCollections(tenantId: string) {
  const db = getDatabase();
  const collections = await db
    .select()
    .from(schema.knowledgeCollections)
    .where(eq(schema.knowledgeCollections.tenantId, tenantId))
    .orderBy(desc(schema.knowledgeCollections.createdAt));

  if (collections.length > 0) return collections;

  // Initialize default system collections
  const defaults = [
    { name: "Institucional & Empresa", slug: "institucional", color: "#3b82f6", description: "Informações sobre a corretora, visão, valores e regras gerais" },
    { name: "Produtos & Planos de Saúde", slug: "produtos", color: "#10b981", description: "Tabelas de preço, coberturas, redes credenciadas e carências" },
    { name: "Operadoras & Parceiras", slug: "operadoras", color: "#8b5cf6", description: "Manuais, regras comerciais e particularidades de cada operadora" },
    { name: "FAQ & Dúvidas Frequentes", slug: "faq", color: "#f59e0b", description: "Perguntas frequentes e respostas padronizadas para clientes" },
    { name: "Políticas & Compliance", slug: "politicas", color: "#ef4444", description: "Regras estritas de conduta, LGPD e diretrizes de IA" },
  ];

  const createdList = [];
  for (const item of defaults) {
    const [c] = await db
      .insert(schema.knowledgeCollections)
      .values({
        id: randomUUID(),
        tenantId,
        isSystem: true,
        ...item,
      })
      .returning();
    createdList.push(c);
  }

  return createdList;
}

// ─── Knowledge Sources & Documents ──────────────────────────────────────────

export async function getKnowledgeDocuments(tenantId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.knowledgeDocuments)
    .where(eq(schema.knowledgeDocuments.tenantId, tenantId))
    .orderBy(desc(schema.knowledgeDocuments.updatedAt));
}

export async function getKnowledgeSuggestions(tenantId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.knowledgeSuggestions)
    .where(eq(schema.knowledgeSuggestions.tenantId, tenantId))
    .orderBy(desc(schema.knowledgeSuggestions.createdAt));
}
